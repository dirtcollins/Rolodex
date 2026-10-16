# Rolodex — Software Features & Structure
**Built by Collins Creative**

## Product Vision
Rolodex is a modern digital Rolodex combining professional contacts, companies, relationships, leads, sales opportunities, and outreach in one application.

**Primary goal:** Help Collins Creative find businesses, build relationships, stay in touch, and turn connections into paying clients.

**Product direction:** A relationship-first personal Rolodex that also manages sales, rather than a conventional sales CRM with contacts added on.

## 1. Dashboard
A daily command center showing:
- Follow-ups due today and overdue follow-ups
- New leads and upcoming meetings
- Active sales opportunities and proposals awaiting responses
- Recent conversations and new contacts
- Sales pipeline value and deals won this month

**Signature feature — Who Should I Contact Today?** Prioritize people based on due follow-ups, active opportunities, and time since the last interaction.

## 2. Contacts — Digital Rolodex
A central record for everyone in the professional network, not just sales leads.

**Contact fields**
- Name and profile photo
- Company, job title, and professional role
- Phone numbers and email addresses
- Website, social profiles, and location
- Optional birthday
- Tags, categories, and notes
- How you met and who introduced you
- Last interaction and next follow-up

**Contact experience**
- Add contacts quickly with minimal required fields.
- Open a full contact page showing details, conversations, associated companies, relationships, tasks, and opportunities.
- A contact can be a prospect, client, former client, referral partner, vendor, friend, or professional connection.

## 3. Companies — Business Directory
A separate directory for organizations, with multiple contacts per company and support for a person being associated with multiple companies.

**Company fields**
- Business name, logo, industry, and description
- Website, phone, email, address, and social profiles
- Company size and estimated revenue, where known
- Associated contacts, notes, and activity history
- Existing software and technology
- Potential needs for Collins Creative services

**Company intelligence:** Record observations such as an outdated website, spreadsheet-based scheduling, or a need for a custom customer portal. These observations can lead to opportunities.

## 4. Leads — Finding Potential Customers
Track prospective customers before a specific project has been identified.

**Capabilities**
- Manual lead creation and CSV import
- Prospect lists by industry and location
- Priority, source, interested services, and outreach status
- Assigned owner and next follow-up date
- Manual movement between stages

**Lead stages**
1. New
2. Researching
3. Ready to Contact
4. Contacted
5. Responded
6. Meeting Scheduled
7. Qualified
8. Not Interested

**Example prospect lists**
- Bakersfield construction companies
- Kern County agricultural businesses
- Property management companies
- Manufacturing companies
- Professional service businesses

**Future capability:** AI-assisted company research and opportunity suggestions.

## 5. Pipeline — Sales Opportunities
A **lead** is someone you might sell to; an **opportunity** is a specific potential project.

**Example opportunity**
- Company: ABC Construction
- Project: Custom Scheduling Software
- Estimated value: $35,000
- Stage: Proposal Sent
- Next action: Follow up Friday

**Opportunity stages**
1. Discovery
2. Qualified
3. Meeting Scheduled
4. Proposal Needed
5. Proposal Sent
6. Negotiating
7. Won
8. Lost
9. On Hold

Track estimated value, services, contacts, notes, tasks, and activity history. A company may have multiple opportunities.

## 6. Network — Relationships & Introductions
The differentiating feature: Rolodex tracks **how people know one another**, not just who they are.

**Track**
- Introductions and who introduced whom
- Mutual connections
- Referral partners and referral history
- Business partnerships and former coworkers
- Relationship strength and professional context

**Example:** Derek introduces you to Brian; Brian works with companies that may need software. Rolodex preserves the connection and shows whether it generates opportunities.

**Future capability:** An interactive relationship map to discover paths to warm introductions.

## 7. Activities — Conversations, Tasks & Follow-Ups
Maintain a unified history of interactions with contacts, companies, and opportunities.

**Activity types**
- Phone calls, emails, and texts
- Meetings and video calls
- LinkedIn messages
- Introductions and notes

**Follow-up tools**
- Tasks, due dates, and reminders
- Recurring reminders and priorities
- Assigned team members
- Completed task history and overdue tasks

**Keep in Touch:** Set a relationship cadence of every 30, 60, 90, or 180 days. Rolodex reminds you to reconnect even when there is no immediate sales opportunity.

## 8. Outreach — Selling Collins Creative Services
Tools to turn researched prospects and relationships into conversations.

**Email**
- Connect business email
- Send from contact profiles
- Reusable templates
- Track sent messages and responses
- Schedule follow-ups
- Organize campaigns

**Sales materials**
- Company introduction
- Portfolio and case studies
- Service descriptions
- Proposal templates
- Pricing information

**Campaigns:** Organize target-company lists, prepare personalized outreach, and track who was contacted, who responded, and who needs follow-up.

## Main Navigation
| Page | Purpose |
|---|---|
| Dashboard | Daily priorities and business overview |
| Contacts | People and professional Rolodex |
| Companies | Business directory |
| Leads | Prospecting and potential customers |
| Pipeline | Sales opportunities and proposals |
| Network | Relationships, introductions, and referrals |
| Activities | Conversations, meetings, tasks, and follow-ups |
| Outreach | Email campaigns and sales communication |

**Settings:** Team members, services, integrations, templates, and account preferences.

**Interface direction:** Full pages for detailed records; centered popups for quick actions and editing. No drawers or slide-out panels.

## Future Feature Roadmap
| Feature | Description | Priority |
|---|---|---|
| AI Company Research | Research company websites and businesses | High |
| AI Sales Opportunities | Suggest services a company may need | High |
| AI Outreach Writer | Draft personalized introductory emails | High |
| Email Integration | Associate emails with contacts | High |
| Calendar Integration | Sync meetings and appointments | High |
| Contact Enrichment | Find missing public business details | Medium |
| Website Audits | Identify website problems and opportunities | High |
| AI Meeting Summaries | Summarize meetings and extract tasks | Medium |
| Referral Tracking | Measure referrals and resulting revenue | Medium |
| Proposal Builder | Create and send proposals | Medium |
| Sales Reporting | Track revenue and conversion rates | Medium |
| Network Mapping | Visualize professional connections | Medium |
| Automated Follow-Ups | Suggest or schedule follow-up sequences | Medium |
| Business Discovery | Find companies matching target criteria | High |
| Mobile Application | Access Rolodex from a phone | Medium |

## Core Data Architecture
**Contacts and Companies are the two central records.** Activities, relationships, leads, opportunities, tasks, and outreach link back to them.

- Avoid entering the same information in multiple places.
- Keep a single contact record as someone evolves from connection to lead to customer to referral partner.
- Keep companies and contacts distinct, but connected.
- Allow multiple opportunities per company.
- Preserve the history of interactions and introductions.

## Unified Search
Search across contacts, companies, relationships, activities, and opportunities.

**Long-term example query:** “Construction companies in Bakersfield that I know through Derek.”

## Recommended Build Phases
### Phase 1 — Your Rolodex
Contacts, companies, notes, tags, search, and imports.

### Phase 2 — Relationships
Introductions, referrals, connections, and interaction history.

### Phase 3 — Sales
Leads, opportunities, pipeline stages, and follow-ups.

### Phase 4 — Outreach
Email integration, prospecting lists, and campaigns.

### Phase 5 — Intelligence
AI research, sales suggestions, and relationship intelligence.

## Key Product Decisions
1. **A contact is not automatically a lead.** The Rolodex contains the whole professional network.
2. **A lead is not automatically an opportunity.** An opportunity represents a specific potential project.
3. **Relationships matter independently of transactions.** Maintain introductions, referrals, and long-term connections.
4. **Use one source of truth for each person and company.** Roles and sales status can change without duplicating records.
5. **Keep workflows simple.** Allow manual stage movement before adding complex automation.
6. **Build for Collins Creative first**, with an architecture that could support a standalone SaaS product later.

## Guiding Product Question
> Who should I talk to next, why should I contact them, and what should I say?

## Open Direction Question
Should Rolodex primarily be:
- **A powerful personal Rolodex that also manages sales** (recommended), or
- A full sales CRM that also manages a professional network?
