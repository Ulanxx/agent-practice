import PptxGenJS from "pptxgenjs";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 配置常量 ---
const PX_TO_INCH = 1 / 96; // 假设 96 DPI
const XML_FILE = "movies_of_the_year_2025.xml";
const OUTPUT_FILE = "Movies_2025_Optimized.pptx";

// 字体映射表：将 XML 中的字体映射为 PPT 常用字体
const FONT_MAP = {
    "Bebas Neue": "Impact", // 如果系统没装 Bebas Neue，退而求其次使用 Impact
    "Montserrat": "Arial",
    "Abril Fatface": "Georgia",
    "Open Sans": "Calibri"
};

/**
 * 颜色与样式工具类
 */
class StyleUtils {
    /**
     * RGBA 转 Hex (PptxGenJS 格式)
     */
    static rgbaToHex(rgbaStr) {
        if (!rgbaStr) return "000000";
        const matches = rgbaStr.match(/[\d\.]+/g);
        if (!matches || matches.length < 3) return "000000";
        
        const r = parseInt(matches[0]).toString(16).padStart(2, '0');
        const g = parseInt(matches[1]).toString(16).padStart(2, '0');
        const b = parseInt(matches[2]).toString(16).padStart(2, '0');
        
        return `${r}${g}${b}`;
    }

    /**
     * 获取透明度百分比
     */
    static getAlpha(rgbaStr) {
        if (!rgbaStr) return 0;
        const matches = rgbaStr.match(/[\d\.]+/g);
        if (matches && matches.length >= 4) {
            return (1 - parseFloat(matches[3])) * 100;
        }
        return 0;
    }

    /**
     * 坐标转换 (PX to Inch)
     */
    static toInch(px) {
        return parseFloat(px || 0) * PX_TO_INCH;
    }
}

/**
 * PPT 元素处理器
 */
class ElementProcessor {
    constructor(pres) {
        this.pres = pres;
    }

    /**
     * 处理文本元素
     */
    processText(slide, el, coords) {
        const content = el.content;
        if (!content) return;

        const textObjects = [];
        const paragraphs = Array.isArray(content.p) ? content.p : [content.p];

        paragraphs.forEach(p => {
            const spans = Array.isArray(p.span) ? p.span : (p.span ? [p.span] : []);
            const alignMap = { left: 'left', center: 'center', right: 'right' };
            const align = alignMap[content['@_textAlign']] || alignMap[p['@_align']] || 'left';

            spans.forEach(span => {
                const rawFont = span['@_fontFamily'] || "Arial";
                textObjects.push({
                    text: span['#text'] || "",
                    options: {
                        fontFace: FONT_MAP[rawFont] || rawFont, // 使用映射或保留原字体
                        fontSize: parseFloat(span['@_fontSize'] || 12),
                        color: StyleUtils.rgbaToHex(span['@_color']),
                        bold: span['@_bold'] === 'true',
                        italic: span['@_italic'] === 'true',
                        charSpacing: parseFloat(span['@_letterSpacing'] || 0), // 支持字间距
                        breakLine: false
                    }
                });
            });

            if (textObjects.length > 0) {
                textObjects[textObjects.length - 1].options.breakLine = true;
                textObjects[textObjects.length - 1].options.align = align;
            }
        });

        const vAlignMap = { top: 'top', middle: 'middle', bottom: 'bottom' };
        const valign = vAlignMap[content['@_verticalAlign']] || 'top';

        slide.addText(textObjects, { ...coords, valign });
    }

    /**
     * 处理形状元素
     */
    processShape(slide, el, coords) {
        const type = el['@_type'];
        const isRound = type === 'round-rect';
        const fillColor = el.fill?.fillColor?.['@_color'];
        const borderColor = el.border?.['@_color'];
        
        const opts = {
            ...coords,
            fill: fillColor ? { color: StyleUtils.rgbaToHex(fillColor), transparency: StyleUtils.getAlpha(fillColor) } : undefined,
            line: borderColor ? { color: StyleUtils.rgbaToHex(borderColor), width: parseFloat(el.border?.['@_width'] || 1) } : undefined,
            rectRadius: isRound ? 0.2 : 0
        };
        
        if (!fillColor && !borderColor) opts.fill = { color: "FFFFFF", transparency: 100 };

        slide.addShape(this.pres.ShapeType.rect, opts);
    }

    /**
     * 处理图片元素
     */
    processImage(slide, el, coords) {
        const src = el['@_src'];
        if (fs.existsSync(src)) {
            slide.addImage({ path: src, ...coords });
        } else {
            slide.addText(`Image not found: ${path.basename(src)}`, { 
                ...coords,
                fill: { color: "CCCCCC" }, 
                fontSize: 10 
            });
        }
    }

    /**
     * 处理线条元素
     */
    processLine(slide, el) {
        const x = StyleUtils.toInch(el['@_startX'] || el['@_topLeftX']);
        const y = StyleUtils.toInch(el['@_startY'] || el['@_topLeftY']);
        const endX = StyleUtils.toInch(el['@_endX'] || 0);
        const endY = StyleUtils.toInch(el['@_endY'] || 0);
        const borderColor = el.border?.['@_color'];
        
        slide.addShape(this.pres.ShapeType.line, {
            x, y, w: endX - x, h: endY - y,
            line: { color: StyleUtils.rgbaToHex(borderColor), width: parseFloat(el.border?.['@_width'] || 2) }
        });
    }
}

/**
 * PPT 生成器主类
 */
class PPTGenerator {
    constructor(xmlPath) {
        this.xmlPath = xmlPath;
        this.pres = new PptxGenJS();
        this.processor = new ElementProcessor(this.pres);
    }

    async generate() {
        try {
            console.log(`正在读取 XML 文件: ${this.xmlPath}...`);
            const xmlData = fs.readFileSync(path.resolve(__dirname, this.xmlPath), "utf8");
            
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_"
            });
            const jsonObj = parser.parse(xmlData);

            // 设置布局
            const config = jsonObj.presentation;
            const width = parseFloat(config['@_width'] || 960) * PX_TO_INCH;
            const height = parseFloat(config['@_height'] || 540) * PX_TO_INCH;
            
            // 使用 defineLayout 注册自定义布局，然后设置 pres.layout
            this.pres.defineLayout({ name: 'CUSTOM_LAYOUT', width, height });
            this.pres.layout = 'CUSTOM_LAYOUT';

            const slidesData = Array.isArray(jsonObj.presentation.slide) 
                ? jsonObj.presentation.slide 
                : [jsonObj.presentation.slide];

            console.log(`开始处理 ${slidesData.length} 张幻灯片...`);

            for (const slideNode of slidesData) {
                this.createSlide(slideNode);
            }

            const finalPath = path.resolve(__dirname, OUTPUT_FILE);
            await this.pres.writeFile({ fileName: finalPath });
            console.log(`成功生成 PPT: ${finalPath}`);
        } catch (error) {
            console.error("生成 PPT 时发生错误:", error);
            throw error;
        }
    }

    createSlide(slideNode) {
        const slide = this.pres.addSlide();

        // 背景色
        const bgFill = slideNode.style?.fill?.fillColor;
        if (bgFill) {
            slide.background = { color: StyleUtils.rgbaToHex(bgFill['@_color']) };
        }

        // 处理元素
        const elements = this.normalizeElements(slideNode.data);
        for (const el of elements) {
            const coords = {
                x: StyleUtils.toInch(el['@_topLeftX']),
                y: StyleUtils.toInch(el['@_topLeftY']),
                w: StyleUtils.toInch(el['@_width']),
                h: StyleUtils.toInch(el['@_height'])
            };

            switch (el.type) {
                case 'shape':
                    if (el['@_type'] === 'text') {
                        this.processor.processText(slide, el, coords);
                    } else {
                        this.processor.processShape(slide, el, coords);
                    }
                    break;
                case 'img':
                    this.processor.processImage(slide, el, coords);
                    break;
                case 'line':
                    this.processor.processLine(slide, el);
                    break;
            }
        }

        // 备注
        if (slideNode.note?.content?.p) {
            const noteText = typeof slideNode.note.content.p === 'string' 
                ? slideNode.note.content.p 
                : (slideNode.note.content.p['#text'] || JSON.stringify(slideNode.note.content.p));
            slide.addNotes(noteText);
        }
    }

    normalizeElements(data) {
        if (!data) return [];
        const elements = [];
        for (const key in data) {
            const items = Array.isArray(data[key]) ? data[key] : [data[key]];
            items.forEach(item => elements.push({ ...item, type: key }));
        }
        return elements;
    }
}

// 启动生成
const generator = new PPTGenerator(XML_FILE);
generator.generate().catch(console.error);
