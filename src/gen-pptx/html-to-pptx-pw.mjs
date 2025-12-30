import PptxGenJS from "pptxgenjs";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 配置常量 ---
const HTML_FILE = "testppt.html";

/**
 * 颜色转换工具
 */
function rgbToHex(rgbStr) {
    if (!rgbStr) return "000000";
    const matches = rgbStr.match(/\d+/g);
    if (!matches || matches.length < 3) return "000000";
    const r = parseInt(matches[0]).toString(16).padStart(2, '0');
    const g = parseInt(matches[1]).toString(16).padStart(2, '0');
    const b = parseInt(matches[2]).toString(16).padStart(2, '0');
    return `${r}${g}${b}`.toUpperCase();
}

/**
 * 字体回退映射：确保在没有安装特定 Web 字体的系统上也能正确显示
 */
const FONT_FALLBACK_MAP = {
    "Inter": "Arial",
    "Noto Sans SC": "Microsoft YaHei",
    "sans-serif": "Arial"
};

/**
 * 图标字符到通用符号的简单回退映射（如果系统没有 FontAwesome 字体）
 */
const ICON_FALLBACK_MAP = {
    "\f013": "⚙", // fa-cog
    "\f140": "🎯", // fa-bullseye
    "\f0c0": "👥", // fa-users
    "\f0e7": "⚡", // fa-bolt
    "\f3ed": "🛡", // fa-shield-halved
    "\f201": "📈", // fa-chart-line
    "\f0e0": "✉", // fa-envelope
    "\f095": "📞", // fa-phone
    "\f015": "🏠", // fa-home
    "\f121": "code", // fa-code
    "\f5d0": "🎨", // fa-palette
    "\f017": "🕒", // fa-clock
    "\f02d": "📖", // fa-book
    "\f007": "👤", // fa-user
    "\f061": "→", // fa-arrow-right
    "\f067": "+", // fa-plus
    "\f00d": "×", // fa-times
    "\f1b2": "🧊", // fa-cube
    "\f1b3": "🧊", // fa-cubes
    "\f12e": "🧩", // fa-puzzle-piece
    "\f542": "🧪", // fa-flask
    "\f544": "⚖", // fa-gavel
    "\f233": "🗄", // fa-server
    "\f132": "🛡", // fa-shield-alt
    "\f085": "⚙", // fa-cogs
    "\f5d1": "⚛"  // fa-atom
};

/**
 * Playwright 驱动的 HTML 转 PPT 转换器
 */
class PlaywrightPptConverter {
    constructor(htmlPath) {
        this.htmlPath = `file://${path.resolve(__dirname, htmlPath)}`;
        this.pres = new PptxGenJS();
        // 设置 16:9 布局 (inches)
        this.pres.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 });
        this.pres.layout = 'CUSTOM';
    }

    async convert() {
        const browser = await chromium.launch();
        const page = await browser.newPage({
            viewport: { width: 1280, height: 720 }
        });

        try {
            console.log(`正在加载并渲染 HTML: ${this.htmlPath}`);
            // 使用 networkidle 确保外部 CSS (Tailwind CDN) 加载完成
            await page.goto(this.htmlPath, { waitUntil: 'networkidle', timeout: 60000 });

            // 注入必要的样式以确保渲染一致性
            await page.addStyleTag({
                content: `
                    .ppt-page-wrapper { margin: 0 !important; padding: 0 !important; }
                    * { -webkit-print-color-adjust: exact !important; }
                `
            });

            // 等待一小会儿确保样式应用
            await page.waitForTimeout(1000);

            // 1. 获取所有幻灯片页面
            const pagesInfo = await page.evaluate(() => {
                const wrappers = Array.from(document.querySelectorAll('.ppt-page-wrapper'));
                return wrappers.map((el, index) => {
                    const style = window.getComputedStyle(el);
                    const wrapperRect = el.getBoundingClientRect();
                    
                    // 解析渐变色
                    const parseGradient = (bgImg) => {
                        if (!bgImg || !bgImg.includes('gradient')) return null;
                        const colors = bgImg.match(/rgba?\(\d+, \d+, \d+(, [\d\.]+)?\)/g);
                        if (colors && colors.length >= 2) {
                            return {
                                type: 'linear',
                                colors: colors
                            };
                        }
                        return null;
                    };

                    // 提取 FontAwesome 图标的 Unicode 字符
                    const getIconChar = (el) => {
                        const style = window.getComputedStyle(el, ':before');
                        const content = style.getPropertyValue('content');
                        if (content && content !== 'none') {
                            return content.replace(/['"]/g, '');
                        }
                        return null;
                    };

                    // 递归提取有意义的内容元素
                    const extractElements = (parent) => {
                        const results = [];
                        const children = Array.from(parent.querySelectorAll('*'));
                        
                        children.forEach(child => {
                            const rect = child.getBoundingClientRect();
                            const computed = window.getComputedStyle(child);
                            
                            // 检查元素是否可见
                            if (rect.width <= 0 || rect.height <= 0 || computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') return;

                            // 计算相对于当前 slide 容器的坐标
                            const relativeX = rect.left - wrapperRect.left;
                            const relativeY = rect.top - wrapperRect.top;

                            const hasDirectText = Array.from(child.childNodes).some(node => node.nodeType === 3 && node.textContent.trim().length > 0);
                            const isImg = child.tagName === 'IMG';
                            const isIcon = child.classList.contains('fas') || child.classList.contains('fa') || child.classList.contains('fab') || child.classList.contains('far');
                            const iconChar = isIcon ? getIconChar(child) : null;

                            // 装饰性容器逻辑
                            const hasBg = computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
                            const hasBorder = computed.borderWidth !== '0px' && computed.borderStyle !== 'none';
                            const hasShadow = computed.boxShadow !== 'none';
                            const hasGradient = computed.backgroundImage.includes('gradient');
                            
                            const isDecorator = (hasBg || hasBorder || hasShadow || hasGradient) && 
                                               (child.children.length === 0 || hasBg || hasBorder);

                            if (!hasDirectText && !isImg && !isIcon && !isDecorator) return;

                            results.push({
                                tag: child.tagName,
                                text: hasDirectText ? child.innerText.trim() : "",
                                src: isImg ? child.src : null,
                                isIcon: isIcon,
                                iconChar: iconChar,
                                isDecorator: isDecorator,
                                rect: {
                                    x: relativeX,
                                    y: relativeY,
                                    w: rect.width,
                                    h: rect.height
                                },
                                style: {
                                    color: computed.color,
                                    backgroundColor: computed.backgroundColor,
                                    backgroundImage: computed.backgroundImage,
                                    fontSize: computed.fontSize,
                                    fontWeight: computed.fontWeight,
                                    fontFamily: computed.fontFamily,
                                    textAlign: computed.textAlign,
                                    borderRadius: computed.borderRadius,
                                    borderWidth: computed.borderWidth,
                                    borderColor: computed.borderColor,
                                    boxShadow: computed.boxShadow,
                                    opacity: computed.opacity,
                                    zIndex: computed.zIndex
                                }
                            });
                        });
                        // 按 z-index 和 DOM 顺序排序
                        return results.sort((a, b) => {
                            const zA = parseInt(a.style.zIndex) || 0;
                            const zB = parseInt(b.style.zIndex) || 0;
                            return zA - zB;
                        });
                    };

                    return {
                        index,
                        width: wrapperRect.width,
                        height: wrapperRect.height,
                        bgColor: style.backgroundColor,
                        backgroundImage: style.backgroundImage,
                        gradient: parseGradient(style.backgroundImage),
                        elements: extractElements(el)
                    };
                });
            });

            console.log(`识别到 ${pagesInfo.length} 张幻灯片，开始处理元素...`);

            const tempDir = path.resolve(__dirname, "temp_slides");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            for (const slideInfo of pagesInfo) {
                const slide = this.pres.addSlide();
                
                // --- 方案调整：每一页先整体截一张图作为底层，确保 100% 还原样式 ---
                const pageElements = await page.$$('.ppt-page-wrapper');
                const screenshotPath = path.join(tempDir, `slide_${slideInfo.index}.png`);
                await pageElements[slideInfo.index].screenshot({ path: screenshotPath });
                
                // 将截图作为背景图片铺满
                slide.addImage({ path: screenshotPath, x: 0, y: 0, w: 13.33, h: 7.5 });

                // --- 混合方案：在截图上方覆盖透明的可编辑文字层 ---
                const scaleX = 13.33 / slideInfo.width;
                const scaleY = 7.5 / slideInfo.height;

                for (const el of slideInfo.elements) {
                    if (el.text) {
                        // 处理字体回退
                        const primaryFont = el.style.fontFamily.split(',')[0].replace(/['"]/g, '');
                        const fontFace = FONT_FALLBACK_MAP[primaryFont] || primaryFont;

                        slide.addText(el.text, {
                            x: el.rect.x * scaleX,
                            y: el.rect.y * scaleY,
                            w: el.rect.w * scaleX,
                            h: el.rect.h * scaleY,
                            color: rgbToHex(el.style.color),
                            fontSize: (parseFloat(el.style.fontSize) * 0.75) || 12,
                            fontFace: fontFace,
                            bold: parseInt(el.style.fontWeight) >= 600,
                            align: el.style.textAlign === 'center' ? 'center' : (el.style.textAlign === 'right' ? 'right' : 'left'),
                            valign: "middle",
                            margin: 0,
                            transparency: 100 // 设置为 100% 透明，但保留文字可搜索/选择
                        });
                    }
                }
            }

            const finalPath = path.resolve(__dirname, Date.now() + ".pptx");
            await this.pres.writeFile({ fileName: finalPath });
            console.log(`成功通过 Playwright 截图方案生成 PPT: ${finalPath}`);
            
            // 清理临时文件 (可选)
            // fs.rmSync(tempDir, { recursive: true, force: true });

        } catch (error) {
            console.error("Playwright 转换出错:", error);
        } finally {
            await browser.close();
        }
    }
}

const converter = new PlaywrightPptConverter(HTML_FILE);
converter.convert();
