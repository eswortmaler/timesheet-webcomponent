import { openDB, DBSchema } from 'idb';

interface TimesheetDB extends DBSchema {
  'timesheet-entries': {
    value: {
      date: string,
      start: string,
      end: string,
      category: string,
      description: string,
      valid: boolean,
      dirty: boolean,
    },
    key: string,
    indexes: { 'by-date': string, 'by-category': string},
  };
}

// set up database, and object store for database
// make changes if database version is bigger than local version
export async function getDB() {
  return await openDB<TimesheetDB>('timesheet-db', 1, {
  upgrade(db) {
    const timesheetStore = db.createObjectStore('timesheet-entries');

    // not actually used right now, because entries are filtered in the component
    timesheetStore.createIndex('by-date', 'date');
    timesheetStore.createIndex('by-category', 'category');
    },
  });
}