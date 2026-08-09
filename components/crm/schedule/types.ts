export interface SerializedTask {
  id:          string
  title:       string
  description: string
  status:      string
  scheduledAt: string | null
  startTime:   string | null
  endTime:     string | null
  isBacklog:   boolean
  marina:      string
  clientId:    string | null
  completedAt: string | null
  createdAt:   string
  client: {
    id:        string
    firstName: string
    lastName:  string
    marina:    string
  } | null
}