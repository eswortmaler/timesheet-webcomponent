import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4 as uuidv4 } from 'uuid';
import { getDB } from "./indexDB";

export type TimeEntry = {
  date: string,
  start: string,
  end: string,
  category: string,
  description: string,
  valid: boolean,
  dirty: boolean,
};

type TimeEntryKey = keyof TimeEntry;

@customElement("lit-timesheet")
export class LitTimesheet extends LitElement {

  @property() entries: Map<string, TimeEntry> = new Map<string, TimeEntry>();
  @property() filterDate: string = "";
  @property() filterCategory: string = "Any";

  static styles = css`
    * {
      font-family: sans-serif;
    }

    table {
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 0.9em;
      border-radius: 5px 5px 0 0;
      overflow: hidden;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
    }

    td {
      padding-top: 5px;
      padding-bottom:5px;
      padding-right:10px;   
    }

    tr {
      text-align: var(--table-tr-text-align, left);
      vertical-align: var(--table-tr-vertical-align, top);
      padding: var(--table-tr-padding, px);
    }

    .invalid {
      background: #ea6767;
      border-bottom: 2px solid #933c3c;
    }

    thead tr {
      background-color: #009879;
      color: #ffffff;
      text-align: left;
      font-weight: bold;
    }

    tbody tr {
      background-color: #dddddd;
      border-bottom: 2px solid #aaaaaa;
    }

    tbody tr:nth-of-type(even) {
      background-color: #bbbbbb;
    }

    tbody tr.invalid:nth-of-type(even) {
      background-color: #b24e4e;
    }

    tbody tr:last-of-type {
      border-bottom: 2px solid #aaaaaa;
    }

    textarea {
      height: 1em;
      width: 296px;
      font-size: 0.9em;
      resize:  none;
    }
  `;

  // load entries from database
  // sort by start time
  async loadEntries() {
    console.log('loading entries');

    // unfortunately indexDB seems to have no way to get entries and key at once
    const db = await getDB();
    const keys = await db.getAllKeys('timesheet-entries');
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const result = await db.get('timesheet-entries', key);
      const entry: TimeEntry = result!;
      this.entries.set(key, entry);
    }
    db.close();
    this.sortEntries();
    this.updateValidationStatus();
    this.requestUpdate(); // show changes in UI
  }

  // saves entry if valid
  // sets dirty flag otherwise
  async saveEntry(entry: TimeEntry, uuid: string) {
    const oldValidFlag = entry.valid;
    if (this.validateEntry(entry, uuid)) {
      console.log(`saving entry ${uuid}`);
      entry.dirty = false;
      const db = await getDB();
      await db.put('timesheet-entries', entry, uuid);
      db.close();
      // previously invalid entry is now valid and saved
      // need to check dirty entries that are now valid too
      if (oldValidFlag) {
        await this.saveValidDitryEntries();
      }
    } else {
      console.log(`entry invalid ${uuid}`);
      entry.dirty = true;
    }
    
  }

  // check all dirty entries and save if valid
  async saveValidDitryEntries() {
    const dirtyEntries = this.filterMap(this.entries, "dirty", true);
    const db = await getDB();
    for (let [dirtyUuid, dirtyEntry] of dirtyEntries) {
      // save valid dirty entries
      if (this.validateEntry(dirtyEntry, dirtyUuid)) {
        console.log(`indirectly valid entry found: saving entry ${dirtyUuid}`);
        dirtyEntry.dirty = false;
        await db.put('timesheet-entries', dirtyEntry, dirtyUuid);
      }
    }
  }

  // deletes entry by UUID from database
  async deleteEntry(entry: TimeEntry, uuid: string) {
    console.log(`deleting entry ${uuid}`);
    this.entries.delete(uuid);
    if (!entry.valid) {
      await this.saveValidDitryEntries();
    }
    const db = await getDB();
    await db.delete('timesheet-entries', uuid);
    db.close();
  }
  
  // returns HTML for component
  render() {
    // filter map of entries
    let filteredEntries = this.entries;
    if (this.filterDate !== "") {
      filteredEntries = this.filterMap(filteredEntries, "date", this.filterDate);
    }
    if (this.filterCategory !== "Any") {
      filteredEntries = this.filterMap(filteredEntries, "category", this.filterCategory);
    }

    return html`
      <h3>Timesheet</h3>
      ${this.renderFilters()}
      ${(filteredEntries.size !== 0)
        ? html`
          <table>
            <thead>
              ${this.renderTableHeader()}
            </thead>
            <tbody>
              ${Array.from(filteredEntries, ([uuid, entry]) => this.renderTableRow(entry, uuid), this)}
            </tbody>
          </table>
        `
        : html`<p>No Entries</p>`
      }
      <input type="button" value="new" @click="${this.addNew}"/>
    `;
  }

  // returns HTML for filter UI
  renderFilters() {
    return html`
      <Input
        type="date"
        .value = ${this.filterDate}
        @input = ${(e: Event) => {
          const input = e.target as HTMLInputElement;
          this.filterDate = input.value;
        }}
      />
      <select
        .value = ${this.filterCategory}
        @input = ${(e: Event) => {
          const input = e.target as HTMLInputElement;
          this.filterCategory = input.value;
        }}
      >
        <option calue=Any>Any</option>
        <option value=Development>Development</option>
        <option value=Support>Support</option>
        <option value=Meeting>Meeting</option>
        <option value=Other>Other</option>
      </select>
      <input type="button" value="Reset Filter" @click="${() => {
        this.filterDate = "";
        this.filterCategory = "Any";
      }}"/>
    `;
  }

  // returns HTML for the table header (always the same)
  renderTableHeader() {
    const titles: string[] = ['Date', 'Start', 'End', 'Catrgory', 'Description', ''];
    return html`
      <tr>
        ${titles.map((key) => {return html`<th>${key}</th>`;})}
      </tr>
    `;

  }

  // returns HTML table row for one entry and set callbacks
  renderTableRow(entry: TimeEntry, uuid: string) {
    return html`
      <tr class=${entry.valid ? '' : 'invalid'}>
        <td>
          <input
            type="date"
            .value="${entry.date}"
            @input=${this.generateInputCallback("date", uuid)}
            }}
          />
        </td>
        <td>
          <input
            type="time"
            .value="${entry.start}"
            @input=${this.generateInputCallback("start", uuid)}
          />
        </td>
        <td>
          <input
            type="time"
            .value="${entry.end}"
            @input=${this.generateInputCallback("end", uuid)}
          />
        </td>
        <td>
          <select
            .value="${entry.category}"
            @input=${this.generateInputCallback("category", uuid)}
          >
            <option value=Development>Development</option>
            <option value=Support>Support</option>
            <option value=Meeting>Meeting</option>
            <option value=Other>Other</option>
          </select>
        </td>
        <td>
          <textarea
            maxlength="255"
            rows="1"
            .value="${entry.description}"
            @input=${this.generateInputCallback("description", uuid)}
          ></textarea>
        </td>
        <td>
          <input type="button" value="Delete" @click="${() => {
            this.deleteEntry(entry, uuid);
            this.requestUpdate();
          }}"/>
        </td>
      </tr>
    `;
  }

  // returns a callback function
  // this updates the field of an entry when input
  generateInputCallback(field: TimeEntryKey, uuid: string) {
    // this is the callback function
    return async (e: any) => {
      const value = e.target.value; // new value of field
      const current = this.entries.get(uuid)!;
      (current[field] as any) = value; // "as any" needed, because entry has string and boolean fields

      this.entries.set(uuid, current);
      this.updateValidationStatus(); // entry changed: update valid flags
      await this.saveEntry(current, uuid); // try to save entry
      this.requestUpdate(); // show changes in UI
    };
  }

  // gets executed automatically
  async firstUpdated() {
    this.loadEntries();
  }

  // sorts entriew by time
  // sorted only when first loadin entries
  sortEntries() {
    this.entries = new Map([...this.entries.entries()].sort((a, b) => {
      const timestampA = Date.parse(`${a[1].date} ${a[1].start}`);
      const timestampB = Date.parse(`${b[1].date} ${b[1].start}`);
      if (timestampA < timestampB) return -1;
      if (timestampA > timestampB) return 1;
      if (a[1].category < b[1].category) return -1;
      if (a[1].category > b[1].category) return 1;
      if (a[1].description < b[1].description) return -1;
      if (a[1].description > b[1].description) return 1;
      return 0;
    }));
  }
  
  async addNew() {
    const uuid = uuidv4(); // generate new unique identifier
    const today = new Date(); // set date to today for convenience

    // convert date to the same format as the date input uses
    // date input format doesn't include the time zone
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // set start and end so it doesn't overlap with other entries if possible
    const start = this.getLatestTime(dateString);
    let end: string;

    // time in the 24 hour format can be compared lexiographically
    if (start >= "23:30") end = "23:59"; // too late, cant't add 30 min without crossing date barrier
    else {
      let startTime = Date.parse(`${dateString} ${start}`);
      startTime += 1000*60*30; // add 30 min (in milliseconds)
      // extract time from locale string  so the timezone matches
      end = new Date(startTime).toLocaleTimeString().slice(0, 5);
    }
    // new entry, dirty flag set to true, will be resolved when saving
    const entry: TimeEntry = { date: dateString, start: start, end: end, category: "Meeting", description: "", valid: false, dirty: true};
    this.entries.set(uuid, entry);
    this.updateValidationStatus();
    this.saveEntry(entry, uuid);
    this.requestUpdate(); // new entry, so vaild status needs to be uptdated
  }

  // returns latest end time of given date
  getLatestTime(date: string) {

    const entriesFromDate = this.filterMap(this.entries, "date", date);
    const latest = [...entriesFromDate.values()].map((entry) => entry.end).reduce((max, current) => {
      return max > current ? max : current;
    }, "07:00");

    return latest;
  }

  // update the valid flag of all entries
  // this is nescessary every time a change made to an entry,
  // because change to one entry can effect the status of another
  updateValidationStatus() {
    for (let [uuid, entry] of this.entries) {
      this.validateEntry(entry, uuid);
    }
  }

  validateEntry(entry: TimeEntry, uuid: string) {

    // check if end time is after start time
    if (entry.start >= entry.end) {
      entry.valid = false;
      console.log("ends before it starts!");
      return false;
    }

    // convert to epoch for comparison
    const start = Date.parse(`${entry.date} ${entry.start}`);
    const end = Date.parse(`${entry.date} ${entry.end}`);

    // compare with other entries
    // local data can differ from database if there is a collision,
    // because it is not saved to the database yet
    // only compare to entries on the same date
    const otherEntries = this.filterMap(this.entries, "date", entry.date);

    for (let [otherUuid, otherEntry] of otherEntries) {

      // skip comparison with itself
      if (uuid === otherUuid) continue;

      // convert to epoch for comparison
      const otherStart = Date.parse(`${otherEntry.date} ${otherEntry.start}`);
      const otherEnd = Date.parse(`${otherEntry.date} ${otherEntry.end}`);

      // check for overlap
      if (
          (otherStart <= start && start < otherEnd) ||
          (start <= otherStart && otherStart < end)
        ) {
        entry.valid = false;
        console.log("collision with other entry!");
        return false;
      }
    }

    // no collisions found
    entry.valid = true;
    return true;
  }

  // returns map of entries where the field equals the query
  // keep type of query generic, this way filtering for the boolean flags is also possible
  filterMap(map: Map<string, TimeEntry>, field: TimeEntryKey, query: any) {
    return  new Map(
      [...map]
      .filter(([_, entry]) => entry[field] === query)
    );
  }
}