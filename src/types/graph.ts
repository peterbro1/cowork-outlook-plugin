// Microsoft Graph API response types

export interface GraphPagedResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

// Mail types

export interface EmailAddress {
  name: string;
  address: string;
}

export interface Recipient {
  emailAddress: EmailAddress;
}

export interface ItemBody {
  contentType: "text" | "html";
  content: string;
}

export interface MailMessage {
  id: string;
  subject: string;
  sender: Recipient;
  from: Recipient;
  toRecipients: Recipient[];
  ccRecipients: Recipient[];
  receivedDateTime: string;
  bodyPreview: string;
  body: ItemBody;
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  importance: "low" | "normal" | "high";
  categories: string[];
}

export interface MailFolder {
  id: string;
  displayName: string;
  parentFolderId: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

export interface MoveMessageResponse {
  id: string;
  parentFolderId: string;
}

// Calendar types

export interface DateTimeTimeZone {
  dateTime: string;
  timeZone: string;
}

export interface Location {
  displayName: string;
  locationType?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    countryOrRegion?: string;
    postalCode?: string;
  };
}

export interface Attendee {
  emailAddress: EmailAddress;
  type: "required" | "optional" | "resource";
  status?: {
    response: "none" | "organizer" | "tentativelyAccepted" | "accepted" | "declined" | "notResponded";
    time: string;
  };
}

export interface RecurrencePattern {
  type: "daily" | "weekly" | "absoluteMonthly" | "relativeMonthly" | "absoluteYearly" | "relativeYearly";
  interval: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  month?: number;
  firstDayOfWeek?: string;
  index?: "first" | "second" | "third" | "fourth" | "last";
}

export interface RecurrenceRange {
  type: "endDate" | "numbered" | "noEnd";
  startDate: string;
  endDate?: string;
  numberOfOccurrences?: number;
  recurrenceTimeZone?: string;
}

export interface PatternedRecurrence {
  pattern: RecurrencePattern;
  range: RecurrenceRange;
}

export interface OnlineMeeting {
  joinUrl: string;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  body: ItemBody;
  start: DateTimeTimeZone;
  end: DateTimeTimeZone;
  location: Location;
  attendees: Attendee[];
  organizer: Recipient;
  isAllDay: boolean;
  recurrence: PatternedRecurrence | null;
  responseStatus: {
    response: string;
    time: string;
  };
  onlineMeeting: OnlineMeeting | null;
  showAs: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
  sensitivity: "normal" | "personal" | "private" | "confidential";
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  owner: EmailAddress;
}

// User profile

export interface UserProfile {
  displayName: string;
  mail: string;
  userPrincipalName: string;
  id: string;
}
