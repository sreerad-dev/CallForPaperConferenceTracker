export type Ranking = 'A*' | 'A' | 'B' | 'Workshop' | 'Industry' | 'Tutorial' | 'New venue' | 'Unknown'
export type Format = 'Hybrid' | 'In-person' | 'Unknown'
export type SubmissionModel = 'Fixed' | 'Rolling' | 'ARR' | 'Talk proposals' | 'Unknown'

export interface Conference {
  id: number
  name: string
  hostOrg: string
  area: string
  location: string
  abstractDeadline: string | null   // ISO date string or null
  fullPaperDeadline: string | null  // ISO date string or null
  notification: string | null
  cameraReady: string | null
  eventDate: string
  ranking: Ranking
  rankingRaw: string
  submissionModel: SubmissionModel
  cfpUrl: string
  format: Format
  isUpcoming: boolean   // deadline within 30 days
  isPassed: boolean     // all deadlines passed
  isRolling: boolean
}

export interface RollingVenue {
  venue: string
  cycle: string
  nextDeadline: string
  notes: string
}

export type AreaFilter =
  | 'All'
  | 'Data Engineering & Databases'
  | 'ML Systems & AI Infrastructure'
  | 'NLP & Language Models'
  | 'Security & Privacy'
  | 'Information Retrieval'
  | 'Distributed Systems & Cloud'
  | 'Observability & Reliability'
  | 'Other'
