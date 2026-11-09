import { isForeignPayment } from '../currency';
import { stageFeeCovered } from '../stage-readiness';
import { actorDisplayName } from '../demo-identities';
import { executiveJourney } from '../executive-kpi';
import { ALL_STAGES, ExecutiveMetrics, CandidateStage, CandidateStatusBucket } from '../types';
import {
    getCandidates, getCandidateStages, getPayments, getMedicalResults, getDocuments,
    getChatMessages, getApprovalLogs, getForeignAgencies, getLocalAgencies, getCocFacilities,
    getPaymentStatuses, getConfig,
} from '../data-store';

const DAY = 86_400_000;
const STUCK_AFTER_DAYS = 14;
const DONE = new Set(['Passed', 'Issued', 'Completed']);

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d: Date) => d.toLocaleString('en-US', { month: 'short' });

const topCounts = (values: Array<string | undefined>, limit: number) => {
    const map = new Map<string, number>();
    values.forEach(v => { const k = v || 'Unassigned'; map.set(k, (map.get(k) ?? 0) + 1); });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
};

// GET /api/admin/executive-metrics
export const getExecutiveMetrics = async (localAgencyName?: string, foreignAgencyName?: string, localAgencyId?: string): Promise<ExecutiveMetrics> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const now = Date.now();
    const localAgency = localAgencyId ? getLocalAgencies().find(l => l.id === localAgencyId)
        : localAgencyName ? getLocalAgencies().find(l => l.name === localAgencyName) : undefined;
    const foreignAgency = foreignAgencyName ? getForeignAgencies().find(agency => agency.name === foreignAgencyName) : undefined;

    let candidates = getCandidates();
    if (localAgencyName || localAgencyId) candidates = localAgency ? candidates.filter(c => c.local_agency_id === localAgency.id) : [];
    if (foreignAgencyName) candidates = foreignAgency ? candidates.filter(c => c.foreign_agency_id === foreignAgency.id) : [];
    const ids = new Set(candidates.map(c => c.id));

    const stagesByCandidate = new Map<string, CandidateStage[]>();
    getCandidateStages().filter(s => ids.has(s.candidate_id)).forEach(s => {
        const list = stagesByCandidate.get(s.candidate_id) ?? [];
        list.push(s);
        stagesByCandidate.set(s.candidate_id, list);
    });
    const ordinalOf = (stageId: number) => ALL_STAGES.find(s => s.id === stageId)?.ordinal ?? 0;

    const funnel = ALL_STAGES.map(stage => ({ stageTitle: stage.title, ordinal: stage.ordinal, reached: 0, completed: 0, blocked: 0, avgDays: 0, conversion: 0 }));
    const durations: number[][] = ALL_STAGES.map(() => []);
    const buckets: Record<CandidateStatusBucket, number> = { Pending: 0, 'In Progress': 0, Completed: 0, Blocked: 0 };
    const stuck: ExecutiveMetrics['needsAttention'] = [];
    const deployedDurations: number[] = [];
    const deployedByMonth = new Map<string, number>();
    let activeAgeSum = 0;
    let activeCount = 0;

    candidates.forEach(c => {
        const stages = (stagesByCandidate.get(c.id) ?? []).sort((a, b) => ordinalOf(a.stage_id) - ordinalOf(b.stage_id));
        const failed = stages.find(s => s.status === 'Failed');
        const doneCount = stages.filter(s => DONE.has(s.status)).length;
        const journey = executiveJourney(c, stages, now);
        const completedAll = journey.deployed;
        const bucket: CandidateStatusBucket = failed ? 'Blocked' : completedAll ? 'Completed' : doneCount > 0 ? 'In Progress' : 'Pending';
        buckets[bucket]++;

        // The candidate's current stage is the first one that is not done.
        const current = stages.find(s => !DONE.has(s.status));
        const currentOrdinal = current ? ordinalOf(current.stage_id) : ALL_STAGES.length + 1;
        funnel.forEach(f => {
            if (currentOrdinal >= f.ordinal) f.reached++;
            const st = stages.find(s => ordinalOf(s.stage_id) === f.ordinal);
            if (st && DONE.has(st.status)) f.completed++;
            if (st && st.status === 'Failed') f.blocked++;
        });

        let prevAt = new Date(c.created_at).getTime();
        stages.forEach(s => {
            if (DONE.has(s.status)) {
                const at = new Date(s.date || s.updated_at).getTime();
                if (at >= prevAt) durations[ordinalOf(s.stage_id) - 1]?.push((at - prevAt) / DAY);
                prevAt = Math.max(prevAt, at);
            }
        });

        if (completedAll) {
            const last = stages[stages.length - 1];
            const at = new Date(last.date || last.updated_at).getTime();
            deployedDurations.push(journey.departureDays!);
            const key = monthKey(new Date(at));
            deployedByMonth.set(key, (deployedByMonth.get(key) ?? 0) + 1);
        } else {
            activeAgeSum += journey.registrationAge;
            activeCount++;
            // Last real movement: a stage that was never started carries its creation stamp, which is not activity.
            const since = stages
                .filter(s => s.status !== 'Pending')
                .reduce((latest, s) => Math.max(latest, new Date(s.date || s.updated_at).getTime()), new Date(c.created_at).getTime());
            const days = Math.floor((now - since) / DAY);
            if (failed || days >= STUCK_AFTER_DAYS) {
                const target = failed ?? current;
                stuck.push({
                    id: c.id,
                    name: `${c.first_name} ${c.last_name}`,
                    trackingCode: c.tracking_code,
                    stageTitle: ALL_STAGES.find(s => s.id === target?.stage_id)?.title ?? 'Registration',
                    daysInStage: days,
                    reason: failed ? 'Failed stage' : 'No movement',
                });
            }
        }
    });

    funnel.forEach((f, i) => {
        const d = durations[i];
        f.avgDays = d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : 0;
        f.conversion = i === 0 ? (candidates.length ? 100 : 0) : funnel[i - 1].reached ? Math.round((f.reached / funnel[i - 1].reached) * 100) : 0;
    });

    // Monthly series for the last 6 months
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
        return { key: monthKey(d), label: monthLabel(d) };
    });
     const payments = getPayments().filter(p => p.status === 'succeeded' && !isForeignPayment(p) && // foreign payments are in other currencies
         (!(localAgencyName || localAgencyId) || !!localAgency && p.payee_local_agency_id === localAgency.id)
         && (!foreignAgencyName || !!foreignAgency && p.candidate_ids.some(id => ids.has(id))));
    const trend = months.map(m => ({
        month: m.label,
        registered: candidates.filter(c => monthKey(new Date(c.created_at)) === m.key).length,
        deployed: deployedByMonth.get(m.key) ?? 0,
        revenue: payments.filter(p => monthKey(new Date(p.created_at)) === m.key).reduce((s, p) => s + p.amount, 0),
    }));

    const last30 = candidates.filter(c => {
        const age = now - new Date(c.created_at).getTime();
        return age >= 0 && age <= 30 * DAY;
    }).length;
    const prev30 = candidates.filter(c => {
        const age = now - new Date(c.created_at).getTime();
        return age > 30 * DAY && age <= 60 * DAY;
    }).length;

    // Finance: expected fees come from the configured stage fees.
    const fees = getConfig().stageFees ?? {};
    const paidSet = getPaymentStatuses();
    let feesDue = 0;
    let feesPaid = 0;
    ALL_STAGES.forEach(stage => {
        const fee = fees[stage.id] ?? stage.fee_amount;
        if (fee === undefined) return;
        candidates.forEach(c => {
            const paid = stageFeeCovered(c, stage.id, fees, paidSet, getPayments());
            const started = (stagesByCandidate.get(c.id) ?? []).some(s => s.stage_id === stage.id && s.status !== 'Pending');
            // A fee is only due once the candidate has reached that stage.
            if (started || paid) feesDue += fee;
            if (paid) feesPaid += fee;
        });
    });
    const collected = payments.reduce((s, p) => s + p.amount, 0);
    const currency = payments[0]?.currency ?? 'USD';

    const medical = getMedicalResults().filter(m => ids.has(m.candidate_id));
    const medicalCounts = { passed: 0, failed: 0, pending: 0 };
    medical.forEach(m => { medicalCounts[m.status === 'Passed' ? 'passed' : m.status === 'Failed' ? 'failed' : 'pending']++; });
    const medicalDecided = medicalCounts.passed + medicalCounts.failed;

    const docs = getDocuments().filter(d => ids.has(d.candidate_id));
    const withKind = (kind: 'work_contract' | 'visa') =>
        candidates.filter(c => docs.some(d => d.candidate_id === c.id && d.doc_kind === kind) ||
            (kind === 'work_contract' ? c.external_status?.work_contract : c.external_status?.visa)).length;
    const contractCount = withKind('work_contract');
    const visaCount = withKind('visa');

    const foreign = getForeignAgencies();
    const coc = getCocFacilities();
    const local = getLocalAgencies();
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

    const unread = getChatMessages().filter(m => ids.has(m.candidate_id) && m.sender === 'candidate' && !m.is_read_by_admin).length;
    const scopedPaymentIds = new Set(getPayments().filter(payment => payment.candidate_ids.some(id => ids.has(id))
        || !!localAgency && payment.payee_local_agency_id === localAgency.id).map(payment => payment.id));
    const activity = getApprovalLogs().filter(log => localAgencyName || localAgencyId || foreignAgencyName
        ? ids.has(log.target_id) || scopedPaymentIds.has(log.target_id)
        : ids.has(log.target_id) || log.target_type !== 'Candidate')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 40)
        .map(l => ({ id: l.id, timestamp: l.timestamp, actor: actorDisplayName(l.actor_id, l.actor_email, candidates), description: l.description, action: l.action, target_id: l.target_id }));

    return {
        generatedAt: new Date().toISOString(),
        totals: {
            candidates: candidates.length,
            active: activeCount,
            deployed: buckets.Completed,
            blocked: buckets.Blocked,
            newLast30: last30,
            newPrev30: prev30,
            deploymentRate: pct(buckets.Completed, candidates.length),
            avgDaysActive: activeCount ? Math.round(activeAgeSum / activeCount) : 0,
            avgDaysToDeploy: deployedDurations.length ? Math.round(deployedDurations.reduce((a, b) => a + b, 0) / deployedDurations.length) : 0,
            unreadMessages: unread,
        },
        status: (Object.keys(buckets) as CandidateStatusBucket[]).map(name => ({ name, value: buckets[name] })),
        funnel,
        trend,
        finance: {
            currency,
            collected,
            feesDue,
            feesPaid,
            outstanding: Math.max(0, feesDue - feesPaid),
            collectionRate: pct(feesPaid, feesDue),
            transactions: payments.length,
            avgTransaction: payments.length ? Math.round(collected / payments.length) : 0,
        },
        medical: { ...medicalCounts, total: medical.length, passRate: pct(medicalCounts.passed, medicalDecided) },
        documents: {
            contractCount,
            visaCount,
            contractRate: pct(contractCount, candidates.length),
            visaRate: pct(visaCount, candidates.length),
            totalFiles: docs.length,
        },
        byOrigin: topCounts(candidates.map(c => c.country_of_origin), 6),
        byForeignAgency: topCounts(candidates.map(c => foreign.find(f => f.id === c.foreign_agency_id)?.name), 6),
        byCocFacility: topCounts(candidates.map(c => coc.find(f => f.id === c.coc_facility_id)?.name), 6),
        byLocalAgency: topCounts(candidates.map(c => local.find(f => f.id === c.local_agency_id)?.name), 6),
        needsAttention: stuck.sort((a, b) => b.daysInStage - a.daysInStage).slice(0, 6),
        needsAttentionTotal: stuck.length,
        activity,
    };
};
