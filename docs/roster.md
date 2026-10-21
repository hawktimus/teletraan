# The roster

The roster is the list of everyone on the team, kept as documents in Sanity of the type Roster person. It is for people who want to see who is on Prime and who is on Nova, and in which role. No panel of the wall shows it yet.

## What is stored

- First name. Required, up to 24 characters, a first name only. The form warns on a space, an @ or a number, so a full name or an email address is caught.
- Role. Student, Mentor, Coach, Parent or Leadership.
- Job title. Optional, up to 28 characters, for example Captain or Lead mentor.
- Team. Both, Prime or Nova, as on every other kind of content. Empty means both.
- Department. Optional. One of the nine departments of a task.
- Portrait. Optional. Added in the Studio only.
- Show on screen and Hide after. Hide after is for someone who graduated or left.
- Order. Optional, a lower number comes first.

The dataset is public. There is no field for an email address, a phone number or a last name, and none should be typed anywhere.

## Where to edit it

- The Studio: People, Roster.
- The control page: Display tab, Content, Roster. It groups people by team and then by role (Leadership, Mentors and Coaches, Students, Parents) with counts. A change is a draft until Publish, as in the Studio. Add person makes a Roster person; the other two kinds are edited, hidden and deleted, and new ones are added in the Studio.
- The control page: Content tab, Roster. It groups people by team and then by role (Leadership, Mentors and Coaches, Students, Parents) with counts. A change is a draft until Publish, as in the Studio.

Leadership and Team leads are separate lists of the Studio that feed the wall. They stay where they are and are not copied into the roster, but the Roster block of the control page lists them in the same view and edits them in place, with the same form as the Studio (limits and warnings included). Each line says where it lives: Roster, Leadership or Team lead.

- Grouping. Team, then role. A Leadership entry listed as Captain and every Team lead are under Leadership; Coach and Mentor entries are under Mentors and Coaches.
- Filter and search. The filter is All, Students, Mentors and coaches, Parents or Leadership. The search matches a first name, and for a Team lead also the subteam name and its members.
- A Team lead's members are lines in its editor with Add and Remove. The stored shape is unchanged, a list of first names.
- Portraits and photos are shown but only the Studio changes them.
- A name with a space, an @ or a number, or a full name, shows a warning while typing and after Save to draft. A warning never blocks a save; a name over its limit does.

## Recommendation

A roster panel for the wall is not part of this work. If the team wants one, it should read the type `rosterPerson` through the content query (`dashboard/core/sanity-query.js`), group by team and role the way `control/static/tabs/content-items.js` does (`rosterGroups`), and keep the rules of the existing panels: first names only, 44 pixel text, one topic at a time. Until then the roster is a list to read on the control page.
