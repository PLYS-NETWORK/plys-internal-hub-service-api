export interface IIdentityConfig {
  readonly identityServiceGrpcUrl: string;
}

export interface IBusinessConfig {
  readonly businessServiceGrpcUrl: string;
}

export interface IConsultantConfig {
  readonly consultantServiceGrpcUrl: string;
}

export interface IInternalAdminConfig {
  readonly internalAdminServiceGrpcUrl: string;
}

export interface IInternalTaskReviewerConfig {
  readonly internalTaskReviewerServiceGrpcUrl: string;
}

export interface IFinanceConfig {
  readonly financeServiceGrpcUrl: string;
}

export interface INotificationsConfig {
  readonly notificationsServiceGrpcUrl: string;
}

export interface IPlatformConfig {
  readonly platformServiceGrpcUrl: string;
}

export interface IAiProviderConfig {
  readonly aiProviderServiceGrpcUrl: string;
}

/** @deprecated Use IBusinessConfig */
export interface IProfilesConfig {
  readonly profilesServiceGrpcUrl: string;
}

/** @deprecated Use IBusinessConfig / IConsultantConfig */
export interface IProjectsConfig {
  readonly projectsServiceGrpcUrl: string;
}
