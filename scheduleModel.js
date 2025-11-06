export const WEEK_SCHEDULE = {
  Monday: {
    AM: {
      label: "Faculty Clinic (Medically Complex)",
      start: "08:00",
      end: "12:00",
      locationLabel: "Main Campus – Complex Care Suite",
      patients: [
        { time: "08:00", id: null, residentPresent: false },
        { time: "09:00", id: null, residentPresent: false },
        { time: "10:00", id: null, residentPresent: false },
        { time: "11:00", id: null, residentPresent: false }
      ]
    },
    PM: {
      label: "Continuity Clinic (+ Residents)",
      start: "13:00",
      end: "17:00",
      locationLabel: "Main Campus – Team A Pods",
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
      label: "St. PJ’s Foster Clinic (+ Resident)",
      start: "08:00",
      end: "12:00",
      locationLabel: "St. PJ’s Shelter",
      patients: [
        { time: "08:00", id: null, residentPresent: true },
        { time: "09:00", id: null, residentPresent: true },
        { time: "10:00", id: null, residentPresent: true },
        { time: "11:00", id: null, residentPresent: true }
      ]
    },
    PM: {
      label: "Administrative Time",
      start: "13:00",
      end: "17:00",
      locationLabel: "Mission Control HQ",
      patients: []
    }
  },
  Wednesday: {
    AM: {
      label: "Craniofacial Clinic Team Block",
      start: "08:00",
      end: "12:00",
      locationLabel: "Craniofacial Center",
      patients: [
        { time: "08:00", id: null, residentPresent: true },
        { time: "09:30", id: null, residentPresent: true },
        { time: "10:30", id: null, residentPresent: false },
        { time: "11:15", id: null, residentPresent: false }
      ]
    },
    PM: {
      label: "Craniofacial Follow-ups",
      start: "13:00",
      end: "17:00",
      locationLabel: "Craniofacial Center",
      patients: [
        { time: "13:00", id: null, residentPresent: true },
        { time: "14:00", id: null, residentPresent: true },
        { time: "15:00", id: null, residentPresent: false },
        { time: "16:00", id: null, residentPresent: false }
      ]
    }
  },
  Thursday: {
    AM: {
      label: "Faculty Clinic (Hybrid Telehealth)",
      start: "08:00",
      end: "12:00",
      locationLabel: "Hybrid Pods",
      patients: [
        { time: "08:00", id: null, residentPresent: false },
        { time: "09:00", id: null, residentPresent: false },
        { time: "10:00", id: null, residentPresent: true },
        { time: "11:00", id: null, residentPresent: true }
      ]
    },
    PM: {
      label: "Resident Continuity Precepting",
      start: "13:00",
      end: "17:00",
      locationLabel: "Main Campus – Precepting Suite",
      patients: [
        { time: "13:00", id: null, residentPresent: true },
        { time: "14:00", id: null, residentPresent: true },
        { time: "15:00", id: null, residentPresent: true },
        { time: "16:00", id: null, residentPresent: true }
      ]
    }
  },
  Friday: {
    AM: {
      label: "St. PJ’s Shelter Rounds (+ Resident)",
      start: "08:00",
      end: "12:00",
      locationLabel: "St. PJ’s Shelter",
      patients: [
        { time: "08:00", id: null, residentPresent: true },
        { time: "09:00", id: null, residentPresent: true },
        { time: "10:00", id: null, residentPresent: true },
        { time: "11:00", id: null, residentPresent: true }
      ]
    },
    PM: {
      label: "Admin / Flex Overflow",
      start: "13:00",
      end: "17:00",
      locationLabel: "Mission Control HQ",
      patients: []
    }
  }
};
