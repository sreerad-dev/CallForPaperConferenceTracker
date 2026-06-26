import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { Conference } from '../types'
import { parseISO, format } from 'date-fns'

interface Props {
  conferences: Conference[]
}

const AREA_COLORS: Record<string, string> = {
  'Data Engineering & Databases':   '#6366f1',
  'ML Systems & AI Infrastructure': '#8b5cf6',
  'NLP & Language Models':          '#ec4899',
  'Security & Privacy':             '#ef4444',
  'Information Retrieval':          '#f59e0b',
  'Distributed Systems & Cloud':    '#10b981',
  'Observability & Reliability':    '#3b82f6',
  'Software Engineering':           '#f97316',
  'Programming Languages':          '#84cc16',
  'Other':                          '#94a3b8',
}

const RANKING_COLORS: Record<string, string> = {
  'A*': '#7c3aed',
  'A': '#2563eb',
  'B': '#0891b2',
  'Workshop': '#64748b',
  'Industry': '#d97706',
  'Tutorial': '#0284c7',
  'New venue': '#db2777',
  'Unknown': '#94a3b8',
}

function classifyArea(area: string): string {
  const a = area.toLowerCase()

  // Security & Privacy — check before 'systems' to avoid false matches
  if (a.includes('security') || a.includes('privacy') || a.includes('crypto')) return 'Security & Privacy'

  // NLP & Language Models — check before 'ai' to avoid grabbing AI Engineering
  if (a.includes('nlp') || a.includes('natural language') || a.includes('computational linguistics') || a.includes('language model')) return 'NLP & Language Models'

  // ML Systems & AI Infrastructure — specific ML/AI terms only
  if (a.includes('ml system') || a.includes('machine learning') || a.includes('deep learning') || a.includes('llm') || a.includes('neural') || a.includes('ai engineering') || a.includes('ai safety') || a.includes('mlops') || a.includes('lminfra') || a.includes('language modeling') || a.includes('rag')) return 'ML Systems & AI Infrastructure'

  // Programming Languages — before 'software engineering' since PLDI/OOPSLA/ECOOP are PL
  if (a.includes('programming language') || a.includes('compiler') || a.includes('object-oriented') || a.includes('program analysis') || a.includes('program comprehension')) return 'Programming Languages'

  // Software Engineering — explicit SE terms
  if (a.includes('software engineering') || a.includes('software testing') || a.includes('software analysis') || a.includes('software maintenance') || a.includes('software evolution') || a.includes('requirements engineering') || a.includes('mining software') || a.includes('model-driven') || a.includes('empirical software') || a.includes('automated software') || a.includes('reengineering') || a.includes('software') ) return 'Software Engineering'

  // Data Engineering & Databases — after SE so 'data mining' in KDD doesn't bleed
  if (a.includes('database') || a.includes('data management') || a.includes('data engineering') || a.includes('data mining') || a.includes('big data') || a.includes('storage') || a.includes('knowledge discovery') || a.includes('information extraction')) return 'Data Engineering & Databases'

  // Information Retrieval
  if (a.includes('information retrieval') || a.includes('recommender') || a.includes('web search') || a.includes('knowledge management') || a.includes('knowledge graph')) return 'Information Retrieval'

  // Observability & Reliability — before 'distributed systems'
  if (a.includes('reliability') || a.includes('observability') || a.includes('fault tolerance')) return 'Observability & Reliability'

  // Distributed Systems & Cloud — 'systems' is a last resort within this bucket
  if (a.includes('distributed') || a.includes('cloud') || a.includes('middleware') || a.includes('networked') || a.includes('operating system') || a.includes('os') || a.includes('hot topics')) return 'Distributed Systems & Cloud'

  return 'Other'
}

export function Charts({ conferences }: Props) {
  // Deadlines by month (next 12 months)
  const monthCounts: Record<string, number> = {}
  const today = new Date()
  for (const conf of conferences) {
    const d = conf.fullPaperDeadline || conf.abstractDeadline
    if (!d || conf.isPassed) continue
    const date = parseISO(d)
    if (date < today) continue
    const key = format(date, 'MMM yy')
    monthCounts[key] = (monthCounts[key] ?? 0) + 1
  }
  const monthData = Object.entries(monthCounts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => {
      const da = new Date(`01 ${a.month}`)
      const db = new Date(`01 ${b.month}`)
      return da.getTime() - db.getTime()
    })

  // By area
  const areaCounts: Record<string, number> = {}
  for (const conf of conferences) {
    const area = classifyArea(conf.area)
    areaCounts[area] = (areaCounts[area] ?? 0) + 1
  }
  const areaData = Object.entries(areaCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // By ranking
  const rankCounts: Record<string, number> = {}
  for (const conf of conferences) {
    rankCounts[conf.ranking] = (rankCounts[conf.ranking] ?? 0) + 1
  }
  const rankData = Object.entries(rankCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Deadlines by month */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Upcoming Deadlines by Month</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(v) => [`${v} deadline(s)`, '']}
            />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By ranking */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">By Ranking</h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={rankData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={65}
              label={({ name, percent }) =>
                percent != null && percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
              }
              labelLine={false}
              fontSize={10}
            >
              {rankData.map((entry) => (
                <Cell key={entry.name} fill={RANKING_COLORS[entry.name] ?? '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* By area */}
      <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Conferences by Research Area</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, areaData.length * 36)}>
          <BarChart data={areaData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={220} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {areaData.map((entry) => (
                <Cell key={entry.name} fill={AREA_COLORS[entry.name] ?? '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
