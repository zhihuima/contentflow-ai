// ============================================================
// 部门数据 API
// ============================================================

import { NextResponse } from 'next/server';
import { getAllDepartments, getDepartment, getAgent, getTotalAgentCount, getOnlineAgentCount } from '@/lib/departments';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const deptId = searchParams.get('id');
    const agentId = searchParams.get('agentId');

    if (agentId) {
        const agent = getAgent(agentId);
        if (!agent) {
            return NextResponse.json({ error: '员工不存在' }, { status: 404 });
        }
        return NextResponse.json({ agent });
    }

    if (deptId) {
        const dept = getDepartment(deptId);
        if (!dept) {
            return NextResponse.json({ error: '部门不存在' }, { status: 404 });
        }
        return NextResponse.json({ department: dept });
    }

    return NextResponse.json({
        departments: getAllDepartments(),
        stats: {
            totalAgents: getTotalAgentCount(),
            onlineAgents: getOnlineAgentCount(),
            totalDepartments: getAllDepartments().length,
        },
    });
}
