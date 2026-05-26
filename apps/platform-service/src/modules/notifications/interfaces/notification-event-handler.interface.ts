import { IAdminNotificationEventHandlerService } from './notification-event-handler-admin.interface';
import { IBusinessNotificationEventHandlerService } from './notification-event-handler-business.interface';
import { IConsultantNotificationEventHandlerService } from './notification-event-handler-consultant.interface';

/**
 * Master contract for the centralized notification event handler.
 * Composed of three role-specific sub-interfaces so each concern is auditable
 * independently while the single implementation class satisfies them all.
 */
export interface INotificationEventHandlerService
  extends
    IAdminNotificationEventHandlerService,
    IBusinessNotificationEventHandlerService,
    IConsultantNotificationEventHandlerService {}
