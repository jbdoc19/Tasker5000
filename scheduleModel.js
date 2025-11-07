export const WEEK_SCHEDULE = {
  Monday: {
    AM: {
      label: "Faculty Clinic",
      start: "08:00",
      end: "12:00",
      locationLabel: "Main Campus – Faculty Clinic",
      residentRequired: false,
      patients: [
        { time: "08:00", id: null, residentPresent: false },
        { time: "09:00", id: null, residentPresent: false },
        { time: "10:00", id: null, residentPresent: false },
        { time: "11:00", id: null, residentPresent: false }
      ]
    },
    PM: {
      label: "Continuity Clinic (Resident Precepting)",
      start: "13:00",
      end: "17:00",
      locationLabel: "Main Campus – Continuity Clinic",
      residentRequired: true,
      patients: [
        { time: "13:00", id: null, residentPresent: true },
        { time: "14:00", id: null, residentPresent: true },
        { time: "15:00", id: null, residentPresent: true },
        { time: "16:00", id: null, residentPresent: true }
      ]
    }
  },
  Tuesday: {
    AM: {
      label: "St. PJ’s Foster Clinic",
      start: "08:00",
      end: "12:00",
      locationLabel: "St. PJ’s Shelter",
      residentRequired: false,
      patients: [
        { time: "08:00", id: null, residentPresent: false },
        { time: "09:00", id: null, residentPresent: false },
        { time: "10:00", id: null, residentPresent: false },
        { time: "11:00", id: null, residentPresent: false }
      ]
    },
    PM: {
      label: "Administrative Time",
      start: "13:00",
      end: "17:00",
      locationLabel: "Mission Control HQ",
      residentRequired: false,
      patients: []
    }
  },
  Wednesday: {
    AM: {
      label: "Faculty Clinic",
      start: "08:00",
      end: "12:00",
      locationLabel: "Main Campus – Faculty Clinic",
      residentRequired: false,
      patients: [
        { time: "08:00", id: null, residentPresent: false },
        { time: "09:00", id: null, residentPresent: false },
        { time: "10:00", id: null, residentPresent: false },
        { time: "11:00", id: null, residentPresent: false }
      ]
    },
    PM: {
      label: "Faculty Clinic",
      start: "13:00",
      end: "17:00",
      locationLabel: "Main Campus – Faculty Clinic",
      residentRequired: false,
      patients: [
        { time: "13:00", id: null, residentPresent: false },
        { time: "14:00", id: null, residentPresent: false },
        { time: "15:00", id: null, residentPresent: false },
        { time: "16:00", id: null, residentPresent: false }
      ]
    }
  },
  Thursday: {
    AM: {
      label: "Didactics / Academics",
      start: "08:00",
      end: "12:00",
      locationLabel: "Academic Conference Center",
      residentRequired: false,
      patients: []
    },
    PM: {
      label: "Administrative Time",
      start: "13:00",
      end: "17:00",
      locationLabel: "Mission Control HQ",
      residentRequired: false,
      patients: []
    }
  },
  Friday: {
    AM: {
      label: "St. PJ’s Foster Clinic",
      start: "08:00",
      end: "12:00",
      locationLabel: "St. PJ’s Shelter",
      residentRequired: false,
      patients: [
        { time: "08:00", id: null, residentPresent: false },
        { time: "09:00", id: null, residentPresent: false },
        { time: "10:00", id: null, residentPresent: false },
        { time: "11:00", id: null, residentPresent: false }
      ]
    },
    PM: {
      label: "Admin / Flex Overflow",
      start: "13:00",
      end: "17:00",
      locationLabel: "Mission Control HQ",
      residentRequired: false,
      patients: []
    }
  }
};
