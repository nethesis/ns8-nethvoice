export type StatusTypes = 'online' | 'cellphone' | 'callforward' | 'dnd' | 'voicemail' | 'busy'

export function asStatusType(status: string): StatusTypes {
  const validStatuses: StatusTypes[] = ['online', 'cellphone', 'callforward', 'dnd', 'voicemail', 'busy']
  return validStatuses.includes(status as StatusTypes) 
    ? (status as StatusTypes) 
    : 'online'
}
