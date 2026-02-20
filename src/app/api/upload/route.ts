import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Dynamic imports for parsers (lazy loaded)
async function parsePDF(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
}

async function parseDocx(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

async function parseXlsx(buffer: Buffer): Promise<string> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        lines.push(`\n## 工作表：${sheetName}`);
        const csv = XLSX.utils.sheet_to_csv(sheet);
        lines.push(csv);
    }
    return lines.join('\n');
}

async function parsePptx(buffer: Buffer): Promise<string> {
    // PPTX is a zip file; we use xlsx to read any embedded sheets,
    // and extract text from XML slides directly
    const XLSX = await import('xlsx');
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const lines: string[] = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            lines.push(`## ${sheetName}`);
            lines.push(XLSX.utils.sheet_to_csv(sheet));
        }
        if (lines.length > 0) return lines.join('\n');
    } catch {
        // Not a valid xlsx/pptx with sheets, try raw text extraction
    }
    // Fallback: extract raw text from the buffer
    const text = buffer.toString('utf-8').replace(/[^\u4e00-\u9fff\u0020-\u007eA-Za-z0-9，。！？、；：""''（）\n\r\t]/g, ' ');
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.slice(0, 10000) || '无法解析 PPT 内容';
}

function imageToBase64(buffer: Buffer, mimeType: string): string {
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_TYPES: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
    'image/gif': 'image',
};

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ error: '请选择文件' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 });
        }

        const fileType = SUPPORTED_TYPES[file.type];
        if (!fileType) {
            return NextResponse.json({
                error: `不支持的文件类型: ${file.type}。支持: PDF, Word, Excel, PPT, 图片`,
            }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let content = '';
        let preview = '';
        let type = fileType;

        switch (fileType) {
            case 'pdf':
                content = await parsePDF(buffer);
                preview = content.slice(0, 200) + (content.length > 200 ? '...' : '');
                break;
            case 'docx':
                content = await parseDocx(buffer);
                preview = content.slice(0, 200) + (content.length > 200 ? '...' : '');
                break;
            case 'xlsx':
                content = await parseXlsx(buffer);
                preview = content.slice(0, 200) + (content.length > 200 ? '...' : '');
                break;
            case 'pptx':
                content = await parsePptx(buffer);
                preview = content.slice(0, 200) + (content.length > 200 ? '...' : '');
                break;
            case 'image': {
                // Save image temporarily and return base64 for Vision API
                const tmpPath = path.join(os.tmpdir(), `upload-${Date.now()}-${file.name}`);
                fs.writeFileSync(tmpPath, buffer);
                content = imageToBase64(buffer, file.type);
                preview = `[图片: ${file.name}]`;
                type = 'image';
                // Clean up temp file after a delay
                setTimeout(() => {
                    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
                }, 60000);
                break;
            }
        }

        return NextResponse.json({
            filename: file.name,
            type,
            size: file.size,
            content: content.slice(0, 50000), // Cap content at 50k chars
            preview,
        });
    } catch (err) {
        console.error('File upload error:', err);
        return NextResponse.json({ error: '文件解析失败，请重试' }, { status: 500 });
    }
}
