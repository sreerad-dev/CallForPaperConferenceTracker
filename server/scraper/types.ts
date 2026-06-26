export type Ranking = 'A*' | 'A' | 'B' | 'Workshop' | 'Industry' | 'Tutorial' | 'New venue' | 'Unknown'
export type Format = 'Hybrid' | 'In-person' | 'Unknown'
export type SubmissionModel = 'Fixed' | 'Rolling' | 'ARR' | 'Talk proposals' | 'Unknown'

/** A fully-resolved conference record ready for rendering */
export interface ConferenceRecord {
  id: number
  name: string
  hostOrg: string
  area: string
  location: string
  abstractDeadline: string | null   // ISO date or null
  fullPaperDeadline: string | null  // ISO date or null
  notification: string | null
  cameraReady: string | null
  eventDate: string
  ranking: Ranking
  submissionModel: SubmissionModel
  cfpUrl: string
  format: Format
  isRolling: boolean
  isPassed: boolean
  isUpcoming: boolean               // deadline within 30 days, not yet passed
  rollingNote?: string              // e.g. "Rolling (1st of month)"
}

/** A resolved rolling venue with computed next deadline */
export interface RollingVenueRecord {
  venue: string
  hostOrg: string
  area: string
  cycle: string
  nextDeadline: string
  cfpUrl: string
}
