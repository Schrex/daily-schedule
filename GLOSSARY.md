# Daily Schedule

The daily crew schedule for Schrex: who works where on the next working day, and how that is sent to the crew.

## Language

### People

**Scheduler**:
The person who builds and sends the Daily Schedule each evening; one of the Editors.
_Avoid_: Manager, project coordinator, admin

**Hub**:
The company app at app.schreiberexcavating.com. People sign in there, and the Daily Schedule reuses that sign-in; it never reads or writes the Hub's data.
_Avoid_: Portal, intranet, main app

**Editor**:
Someone listed as an editor on the Daily Schedule's access list, who may change it: the Scheduler's screen and Settings.
_Avoid_: Admin, owner

**Viewer**:
Anyone signed in to the Hub who isn't an Editor. They may only look at Daily Schedules that have been Sent, on the Crew Page.
_Avoid_: Guest, read-only user

**Crew Member**:
A person who can be placed on the Daily Schedule.
_Avoid_: Employee, worker, resource

**Foreman**:
A Crew Member flagged to be listed first on a Job.
_Avoid_: Lead, supervisor, boss

### The schedule

**Daily Schedule**:
The complete placement of every Crew Member for one working day, with the Tasks for each Job.
_Avoid_: Sheet, plan

**Roster**:
The list of Crew Members and Jobs that Daily Schedules are built from.
_Avoid_: Crew list, directory, master list

**Job**:
A construction project that Crew Members are placed on, with or without a job number (J2601 TIUNY, Cobblestone). Jobs come and go.
_Avoid_: Project, site

**Standing Row**:
One of the three permanent non-Job places on every Daily Schedule: Shop, Trucking, Off Work.
_Avoid_: Category, special job

**Folded Job**:
A Job drawn as a button in the "No crew tomorrow" row instead of a card, because nobody was on it when the board was loaded, the date changed or the last Send succeeded. Never saved: putting someone on it, or tapping it, makes it a card again for the rest of the session.
_Avoid_: Hidden job, inactive job

**Placement**:
One Crew Member on one Job or Standing Row for one day. A Crew Member has at most one Placement per day.
_Avoid_: Assignment, allocation

**Not Placed**:
The state of a Crew Member who has no Placement yet on the Daily Schedule being built. The Not Placed list is in roster order until the Scheduler drags names into an order of their own, which the next day's Daily Schedule keeps.
_Avoid_: Unassigned, available

**Task**:
A free-text line describing work on a Job, or in the Shop or Trucking, for one day ("Strip topsoil", "Go get the truck in PA"). Off Work has none.
_Avoid_: Activity, scope

**Note**:
A short free-text remark attached to one Placement ("1/2 Day").
_Avoid_: Comment, flag

**Person Task**:
A free-text line about one placed Crew Member only, for one day ("Dewatering", "2:00 PM VAC truck training"), shown under their name. It goes with them if they move to another Job; any time is just part of the text.
_Avoid_: Personal note, sub-task

**Day Note**:
A free-text remark for everyone on one Daily Schedule ("Brody may have to go to TIUNY after Wintergarden"), shown under the Jobs as Notes (and across the top of the crew picture and the Office TV).
_Avoid_: Announcement, comment

**Send**:
The Scheduler's act of delivering the finished Daily Schedule to the crew.
_Avoid_: Publish, post, share

**Office TV**:
The page (`/daily-schedule/tv`) that shows today's Daily Schedule full screen on the TV in the office: as it was last Sent, or as the board stands if it was never Sent. On a day with no Daily Schedule (a weekend), the next one Sent.
_Avoid_: Display, dashboard, kiosk

**Crew Page**:
The page (`/daily-schedule/crew`) a Viewer gets, on a phone or a computer: the newest Daily Schedule that has been Sent, exactly as the crew got it, read-only, with one step back to the Sent Daily Schedule before it. A Daily Schedule never Sent, and changes made since the last Send, are not on it.
_Avoid_: Crew view, read-only board, mobile view
