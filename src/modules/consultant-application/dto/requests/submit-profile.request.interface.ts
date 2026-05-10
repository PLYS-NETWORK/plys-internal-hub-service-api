export interface ISubmitProfileRequest {
  readonly headline: string;
  readonly bio: string;
  readonly yearsOfExperience: number;
  readonly skillIds: string[];
}
