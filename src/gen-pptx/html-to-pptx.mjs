import PptxGenJS from "pptxgenjs";
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 配置常量 ---
const HTML_FILE = "testppt.html";
const OUTPUT_FILE = "Agent_Sorrow.pptx";

/**
 * 样式解析工具类：尝试将 Tailwind 类名和内联样式映射到 PPT
 */
class StyleMapper {
    static getColors(el) {
        const classList = el.classList;
        let bgColor = "FFFFFF";
        let textColor = "000000";

        // 极简 Tailwind 颜色映射示例
        if (classList.contains("bg-blue-900")) bgColor = "1E3A8A";
        if (classList.contains("bg-gradient-to-br")) bgColor = "1E3A8A"; // 简化渐变为纯色
        if (classList.contains("text-white")) textColor = "FFFFFF";
        if (classList.contains("text-blue-200")) textColor = "BFDBFE";
        if (classList.contains("text-gray-700")) textColor = "374151";
        if (classList.contains("text-gray-800")) textColor = "1F2937";
        if (classList.contains("text-red-600")) textColor = "DC2626";

        return { bgColor, textColor };
    }

    static getFontSize(el) {
        const classList = el.classList;
        if (classList.contains("text-6xl")) return 60;
        if (classList.contains("text-4xl")) return 40;
        if (classList.contains("text-2xl")) return 24;
        if (classList.contains("text-xl")) return 20;
        if (classList.contains("text-lg")) return 18;
        if (classList.contains("text-sm")) return 14;
        return 12; // 默认字号
    }

    static isBold(el) {
        return el.classList.contains("font-bold") || el.classList.contains("font-semibold") || el.tagName === "H1" || el.tagName === "H2";
    }
}

/**
 * HTML 转 PPT 处理器
 */
class HtmlToPptConverter {
    constructor(htmlPath) {
        this.htmlPath = htmlPath;
        this.pres = new PptxGenJS();
        // 设置 16:9 布局
        this.pres.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 });
        this.pres.layout = 'CUSTOM';
    }

    async convert() {
        try {
            const htmlContent = fs.readFileSync(path.resolve(__dirname, this.htmlPath), "utf8");
            const dom = new JSDOM(htmlContent);
            const document = dom.window.document;

            // 寻找所有 ppt-page-wrapper
            const pages = document.querySelectorAll(".ppt-page-wrapper");
            console.log(`找到 ${pages.length} 个幻灯片页面...`);

            pages.forEach((page, index) => {
                this.processPage(page, index);
            });

            const finalPath = path.resolve(__dirname, OUTPUT_FILE);
            await this.pres.writeFile({ fileName: finalPath });
            console.log(`成功转换并生成 PPT: ${finalPath}`);
        } catch (error) {
            console.error("转换失败:", error);
        }
    }

    processPage(pageEl, index) {
        const slide = this.pres.addSlide();
        const { bgColor } = StyleMapper.getColors(pageEl);
        slide.background = { color: bgColor };

        // 递归处理子元素
        this.processElements(pageEl, slide);
    }

    processElements(parentEl, slide) {
        // 这只是一个高度简化的示例
        // 实际转换需要根据元素的视觉位置（getBoundingClientRect）或相对布局计算坐标
        // 由于 Node 环境下 JSDOM 不支持真实布局计算，这里采用硬编码区域或简单的垂直堆叠模拟

        const titles = parentEl.querySelectorAll("h1, .text-6xl, .text-4xl");
        titles.forEach((el, i) => {
            const { textColor } = StyleMapper.getColors(el);
            slide.addText(el.textContent.trim(), {
                x: 1,
                y: 1 + (i * 1.5),
                w: "80%",
                h: 1,
                fontSize: StyleMapper.getFontSize(el),
                color: textColor,
                bold: StyleMapper.isBold(el),
                align: "center"
            });
        });

        const paragraphs = parentEl.querySelectorAll("p, .text-gray-600, .text-gray-700");
        paragraphs.forEach((el, i) => {
            const { textColor } = StyleMapper.getColors(el);
            slide.addText(el.textContent.trim(), {
                x: 1,
                y: 3 + (i * 0.5),
                w: "80%",
                h: 0.5,
                fontSize: StyleMapper.getFontSize(el),
                color: textColor,
                align: "left"
            });
        });

        const images = parentEl.querySelectorAll("img");
        images.forEach((img, i) => {
            const src = img.getAttribute("src");
            // 忽略占位图地址，防止网络问题导致奔溃
            if (src && src.startsWith("http") && !src.includes("placeholder")) {
                slide.addImage({ path: src, x: 2 + (i * 4), y: 4, w: 3, h: 2 });
            } else if (src && src.includes("placeholder")) {
                // 占位图用矩形代替
                slide.addShape(this.pres.ShapeType.rect, {
                    x: 2 + (i * 4), y: 4, w: 3, h: 2,
                    fill: { color: "CCCCCC" },
                    line: { color: "999999", width: 1 }
                });
                slide.addText("Image Placeholder", {
                    x: 2 + (i * 4), y: 4, w: 3, h: 2,
                    fontSize: 10, align: "center", valign: "middle"
                });
            }
        });
    }
}

const converter = new HtmlToPptConverter(HTML_FILE);
converter.convert();
