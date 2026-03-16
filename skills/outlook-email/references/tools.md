# Email tool reference

## list_messages

List messages from inbox or a specific folder.

Parameters:
- `folderId` (optional, string) — Folder ID to list from. Omit for inbox.
- `top` (optional, number, 1-50, default 10) — Number of messages to return.
- `skip` (optional, number) — Number of messages to skip for pagination.

Output: Pipe-delimited rows `id|received|from|subject|preview` with `hasMore` and `nextSkip` indicators.

## get_message

Read a full email message with sanitized body content.

Parameters:
- `messageId` (required, string) — The message ID.

Output: Formatted text with subject, from, to, cc, date, importance, attachments flag, categories, and sanitized body wrapped in boundary markers.

## search_messages

Search emails using keywords or KQL syntax.

Parameters:
- `query` (required, string) — Search query. Supports KQL: `subject:quarterly`, `from:alice@example.com`, `hasAttachments:true`, or plain text.
- `top` (optional, number, 1-25, default 10) — Maximum results.

Output: Pipe-delimited rows, same format as list_messages.

## list_mail_folders

List all mail folders.

Parameters: None.

Output: Pipe-delimited rows `id|name|unread|total`.

## create_mail_folder

Create a new mail folder.

Parameters:
- `displayName` (required, string) — Name for the new folder.
- `parentFolderId` (optional, string) — Parent folder ID for creating a subfolder. Omit for top-level.

Output: Confirmation with folder name and ID.

## archive_message

Move one or more messages to the Archive folder.

Parameters:
- `messageIds` (required, string[]) — Array of message IDs to archive.

Output: Summary with count of moved messages and any failures.

## move_message

Move one or more messages to a specified folder.

Parameters:
- `messageIds` (required, string[]) — Array of message IDs to move.
- `destinationFolderId` (required, string) — Target folder ID. Use list_mail_folders to find IDs.

Output: Summary with count of moved messages and any failures.

## mark_message_read

Mark a message as read or unread.

Parameters:
- `messageId` (required, string) — The message ID.
- `isRead` (required, boolean) — true to mark read, false for unread.

Output: Confirmation.

## create_draft

Create a draft email (does NOT send).

Parameters:
- `subject` (required, string) — Email subject.
- `body` (required, string) — Email body content.
- `bodyType` (optional, "text" or "html", default "html") — Content type.
- `toRecipients` (required, string[]) — Array of email addresses.
- `ccRecipients` (optional, string[]) — CC recipients.
- `importance` (optional, "low", "normal", or "high") — Default "normal".

Output: Confirmation with draft ID.
