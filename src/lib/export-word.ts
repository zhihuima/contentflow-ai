// ============================================================
// Word 文档导出工具
// ============================================================
import {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    ShadingType,
    Packer,
    TableRow,
    TableCell,
    Table,
    WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Script } from './types';

export async function exportToWord(script: Script) {
    const children: (Paragraph | Table)[] = [];

    // ---- 标题页 ----
    children.push(new Paragraph({ spacing: { after: 600 } }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: '视频号短视频脚本', size: 48, bold: true, color: '1a1a2e' })],
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: 'ContentFlow \u00b7 \u521b\u6d41 AI \u751f\u6210', size: 22, color: '94a3b8' })],
    }));

    // ---- 视频标题 ----
    addHeading(children, '视频标题（备选）');
    script.titles?.forEach((t, i) => {
        children.push(new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({ text: `${i + 1}. `, bold: true, color: '2563eb', size: 22 }),
                new TextRun({ text: t, size: 22 }),
            ],
        }));
    });

    // ---- 封面文案 ----
    addHeading(children, '封面文案（备选）');
    script.cover_texts?.forEach((t, i) => {
        children.push(new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({ text: `${i + 1}. `, bold: true, color: '2563eb', size: 22 }),
                new TextRun({ text: t, size: 22 }),
            ],
        }));
    });

    // ---- 开播三秒钩子 ----
    addHeading(children, `开播三秒钩子（${script.hook?.type}）`);
    children.push(new Paragraph({
        spacing: { after: 80 },
        shading: { type: ShadingType.CLEAR, fill: 'fffbeb' },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: 'd97706' } },
        indent: { left: 200 },
        children: [
            new TextRun({ text: '口播：', bold: true, size: 22, color: 'd97706' }),
            new TextRun({ text: script.hook?.content || '', size: 22 }),
        ],
    }));
    children.push(new Paragraph({
        spacing: { after: 200 },
        indent: { left: 200 },
        children: [
            new TextRun({ text: '画面：', bold: true, size: 20, color: '94a3b8' }),
            new TextRun({ text: script.hook?.visual || '', size: 20, color: '475569' }),
        ],
    }));

    // ---- 金句 ----
    if (script.golden_quotes?.length) {
        addHeading(children, '金句');
        script.golden_quotes.forEach((q) => {
            children.push(new Paragraph({
                spacing: { after: 120 },
                border: { left: { style: BorderStyle.SINGLE, size: 6, color: 'd97706' } },
                shading: { type: ShadingType.CLEAR, fill: 'fffbeb' },
                indent: { left: 200 },
                children: [
                    new TextRun({ text: `"${q}"`, size: 24, bold: true, italics: true, color: '1a1a2e' }),
                ],
            }));
        });
    }

    // ---- 内容分镜 ----
    addHeading(children, '内容分镜');
    if (script.main_body?.length) {
        const rows = [
            new TableRow({
                tableHeader: true,
                children: ['时间', '口播内容', '画面描述', '备注'].map(text =>
                    new TableCell({
                        shading: { type: ShadingType.CLEAR, fill: '2563eb' },
                        children: [new Paragraph({
                            children: [new TextRun({ text, bold: true, color: 'ffffff', size: 20 })],
                        })],
                    })
                ),
            }),
            ...script.main_body.map(seg =>
                new TableRow({
                    children: [
                        tableCell(seg.time_range),
                        tableCell(seg.narration),
                        tableCell(seg.visual),
                        tableCell(seg.note || '-'),
                    ],
                })
            ),
        ];

        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
        }));
        children.push(new Paragraph({ spacing: { after: 200 } }));
    }

    // ---- 互动设计 ----
    addHeading(children, '互动设计');
    script.interaction_points?.forEach((p) => {
        children.push(new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({ text: `[${p.position}] `, bold: true, color: '0d9488', size: 20 }),
                new TextRun({ text: `${p.strategy}：`, bold: true, size: 20 }),
                new TextRun({ text: p.design, size: 20 }),
            ],
        }));
    });

    // ---- 结尾设计 ----
    addHeading(children, `结尾设计（${script.ending?.type}）`);
    children.push(new Paragraph({
        spacing: { after: 80 },
        children: [
            new TextRun({ text: '口播：', bold: true, size: 22 }),
            new TextRun({ text: script.ending?.content || '', size: 22 }),
        ],
    }));
    children.push(new Paragraph({
        spacing: { after: 200 },
        children: [
            new TextRun({ text: 'CTA：', bold: true, size: 22, color: '2563eb' }),
            new TextRun({ text: script.ending?.cta || '', size: 22, color: '2563eb' }),
        ],
    }));

    // ---- 完整口播稿 ----
    addHeading(children, '完整口播稿');
    children.push(new Paragraph({
        spacing: { after: 100 },
        shading: { type: ShadingType.CLEAR, fill: 'f5f6f8' },
        border: { left: { style: BorderStyle.SINGLE, size: 4, color: '2563eb' } },
        indent: { left: 200 },
        children: [new TextRun({ text: script.full_narration || '', size: 22 })],
    }));
    children.push(new Paragraph({
        spacing: { after: 200 },
        children: [
            new TextRun({ text: `字数：${script.word_count}`, size: 18, color: '94a3b8' }),
            new TextRun({ text: `  |  预估时长：${script.estimated_duration}`, size: 18, color: '94a3b8' }),
        ],
    }));

    // ---- BGM & 拍摄建议 ----
    if (script.bgm_suggestion || script.shooting_tips?.length) {
        addHeading(children, '拍摄建议 & BGM');
        if (script.bgm_suggestion) {
            children.push(new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: '♪ BGM：', bold: true, size: 20 }),
                    new TextRun({ text: script.bgm_suggestion, size: 20 }),
                ],
            }));
        }
        script.shooting_tips?.forEach((tip, i) => {
            children.push(new Paragraph({
                spacing: { after: 80 },
                children: [
                    new TextRun({ text: `▸ 建议 ${i + 1}：`, bold: true, size: 20 }),
                    new TextRun({ text: tip, size: 20 }),
                ],
            }));
        });
    }

    // ---- 封面设计方案 ----
    if (script.cover_suggestions?.length) {
        addHeading(children, '封面设计方案');
        script.cover_suggestions.forEach((c, i) => {
            children.push(new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: `方案 ${i + 1}：${c.style}`, bold: true, size: 24, color: '2563eb' })],
            }));
            children.push(makeLine('大字', c.title_text));
            children.push(makeLine('小字', c.subtitle_text));
            children.push(makeLine('配色', c.color_scheme));
            children.push(makeLine('布局', c.layout));
            children.push(makeLine('氛围', c.mood));
            children.push(new Paragraph({ spacing: { after: 200 } }));
        });
    }

    // ---- 生成文档 ----
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: 'Microsoft YaHei', size: 22 },
                },
            },
        },
        sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `脚本_${script.titles?.[0]?.slice(0, 20) || '导出'}.docx`);
}

// ---- Helpers ----
function addHeading(children: (Paragraph | Table)[], text: string) {
    children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' } },
        children: [new TextRun({ text, bold: true, size: 28, color: '1a1a2e' })],
    }));
}

function makeLine(label: string, value: string): Paragraph {
    return new Paragraph({
        spacing: { after: 60 },
        indent: { left: 400 },
        children: [
            new TextRun({ text: `${label}：`, bold: true, size: 20, color: '475569' }),
            new TextRun({ text: value, size: 20 }),
        ],
    });
}

function tableCell(text: string): TableCell {
    return new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text, size: 20 })],
        })],
    });
}
