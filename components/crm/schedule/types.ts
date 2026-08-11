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
  boatId:      string | null
  completedAt: string | null
  createdAt:   string
  client: {
    id:        string
    firstName: string
    lastName:  string
    marina:    string
  } | null
  boat: {
    id:    string
    name:  string
    model: string
  } | null
}

export interface ClientWithBoats {
  id:        string
  firstName: string
  lastName:  string
  boats: {
    id:    string
    name:  string
    model: string
  }[]
}
