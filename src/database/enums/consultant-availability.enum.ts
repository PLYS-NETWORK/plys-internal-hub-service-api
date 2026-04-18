export enum ConsultantAvailability {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  UNAVAILABLE = 'unavailable',
}

export const CONSULTANT_AVAILABILITIES: readonly ConsultantAvailability[] = [
  ConsultantAvailability.FULL_TIME,
  ConsultantAvailability.PART_TIME,
  ConsultantAvailability.CONTRACT,
  ConsultantAvailability.UNAVAILABLE,
];
