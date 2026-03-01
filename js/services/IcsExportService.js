/**
 * Service for exporting schedules to iCalendar format (RFC 5545)
 */
export default {
  /**
   * Downloads schedule as ICS file
   * @param {Array} scheduleItems - Schedule items (courses from current schedule)
   * @param {String} filename - Output filename
   */
  downloadIcs(scheduleItems, filename = 'horario-ucab.ics') {
    console.log('[ICS] Starting export with', scheduleItems?.length, 'items');
    
    if (!scheduleItems || scheduleItems.length === 0) {
      throw new Error('No hay materias para exportar');
    }
    
    const icsContent = this._generateIcs(scheduleItems);
    console.log('[ICS] Generated content length:', icsContent.length);
    console.log('[ICS] First 500 chars:', icsContent.substring(0, 500));
    
    this._downloadFile(icsContent, filename);
    console.log('[ICS] Downloaded:', filename);
  },

  /**
   * Generates ICS content from schedule items
   * @param {Array} scheduleItems - Schedule courses
   * @return {String} ICS file content
   */
  _generateIcs(scheduleItems) {
    if (!scheduleItems || scheduleItems.length === 0) {
      throw new Error('No hay materias para exportar');
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Horarios UCAB//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Horario UCAB'
    ];

    // Add VTIMEZONE for America/Caracas
    lines.push(
      'BEGIN:VTIMEZONE',
      'TZID:America/Caracas',
      'X-LIC-LOCATION:America/Caracas',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0400',
      'TZNAME:VET',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE'
    );

    const semesterDates = this._getSemesterDates();
    console.log('[ICS] Semester dates:', semesterDates);

    scheduleItems.forEach(course => {
      if (!course.section || !course.section.meetingsFaculty) return;

      course.section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;

        const mt = meeting.meetingTime;
        const days = this._getMeetingDays(mt);

        if (days.length === 0) return;

        const events = this._generateRecurringEvents(
          course,
          meeting,
          mt,
          days,
          semesterDates
        );
        lines.push(...events);
      });
    });

    lines.push('END:VCALENDAR');

    return lines.join('\r\n') + '\r\n';
  },

  /**
   * Generates recurring events for a meeting
   * @param {Object} course - Course object
   * @param {Object} meeting - Meeting object
   * @param {Object} mt - Meeting time object
   * @param {Array} days - Array of day abbreviations
   * @param {Object} dates - Semester start/end dates
   * @return {Array} Event lines
   */
  _generateRecurringEvents(course, meeting, mt, days, dates) {
    const lines = [];
    const uid = this._generateUid(course, meeting);
    const summary = `${course.subject}${course.courseNumber} - ${this._decodeHtmlEntities(course.courseTitle)}`;
    const description = `NRC: ${course.section.courseReferenceNumber} | Sección: ${course.section.sequenceNumber}`;
    const location = this._extractLocation(meeting);

    // Use first day of semester as start date, adjusted for the day of week
    const firstSemesterDay = dates.start;
    const dayOfWeek = firstSemesterDay.getDay(); // 0 = Sunday
    
    // Day abbreviations in ICS order (Monday = 1)
    const icsDayMap = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };
    
    // Find the first occurrence of each day in the semester
    const adjustedDates = days.map(dayAbbr => {
      const targetDayNum = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }[dayAbbr];
      let daysToAdd = targetDayNum - dayOfWeek;
      if (daysToAdd < 0) daysToAdd += 7;
      
      const date = new Date(firstSemesterDay);
      date.setDate(firstSemesterDay.getDate() + daysToAdd);
      return date;
    });

    const startDate = adjustedDates[0];
    const dtStart = this._formatDateTimeWithTz(startDate, mt.beginTime);
    const dtEnd = this._formatDateTimeWithTz(startDate, mt.endTime);

    const byday = days.join(',');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${this._formatDateTimeWithTz(new Date(), '0000')}`);
    lines.push(`DTSTART;TZID=America/Caracas:${dtStart}`);
    lines.push(`DTEND;TZID=America/Caracas:${dtEnd}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${this._formatDate(dates.end)}`);
    lines.push(`SUMMARY:${this._escapeText(summary)}`);
    lines.push(`DESCRIPTION:${this._escapeText(description)}`);
    lines.push(`LOCATION:${this._escapeText(location)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');

    return lines;
  },

  /**
   * Gets semester dates (hardcoded for academic calendar)
   * @return {Object} Start and end dates
   */
  _getSemesterDates() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let start, end;
    if (month >= 0 && month <= 4) {
      start = new Date(year, 0, 15);
      end = new Date(year, 4, 31);
    } else if (month >= 5 && month <= 7) {
      start = new Date(year, 6, 15);
      end = new Date(year, 7, 31);
    } else {
      start = new Date(year, 8, 1);
      end = new Date(year, 11, 15);
    }

    return { start, end };
  },

  /**
   * Gets start date for a specific day of week
   * @param {String} dayAbbr - Day abbreviation (MO, TU, etc.)
   * @return {Date} Date of next occurrence of that day
   */
  _getStartDateForDay(dayAbbr) {
    const dayMap = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const targetDay = dayMap[dayAbbr];
    const now = new Date();
    const currentDay = now.getDay();
    const diff = targetDay - currentDay;
    const daysToAdd = diff >= 0 ? diff : diff + 7;

    const result = new Date(now);
    result.setDate(now.getDate() + daysToAdd);
    return result;
  },

  /**
   * Formats date and time for ICS with TZID (YYYYMMDDTHHMMSS)
   * @param {Date} date - Date object
   * @param {String} time - Time in HHMM format
   * @return {String} Formatted datetime
   */
  _formatDateTimeWithTz(date, time) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = time.substring(0, 2);
    const minutes = time.substring(2);
    return `${year}${month}${day}T${hours}${minutes}00`;
  },

  /**
   * Formats date and time for ICS (YYYYMMDDTHHMMSS)
   * @param {Date} date - Date object
   * @param {String} time - Time in HHMM format
   * @return {String} Formatted datetime
   */
  _formatDateTime(date, time) {
    const dateStr = this._formatDate(date);
    const timeStr = this._formatTime(time);
    return `${dateStr}T${timeStr}`;
  },

  /**
   * Formats date for ICS (YYYYMMDD)
   * @param {Date} date - Date object
   * @return {String} Formatted date
   */
  _formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  },

  /**
   * Formats time for ICS (HHMMSS)
   * @param {String} time - Time in HHMM format
   * @return {String} Formatted time
   */
  _formatTime(time) {
    if (!time) return '000000';
    const hours = time.substring(0, 2);
    const minutes = time.substring(2);
    return `${hours}${minutes}00`;
  },

  /**
   * Extracts location/room from meeting
   * @param {Object} meeting - Meeting object
   * @return {String} Location string
   */
  _extractLocation(meeting) {
    if (!meeting) return 'N/A';

    const room = meeting.meetingTime?.room || '';
    const building = meeting.building || '';

    if (building && room) {
      return `${building} - ${room}`;
    } else if (room) {
      return room;
    } else if (building) {
      return building;
    }
    return 'N/A';
  },

  /**
   * Gets meeting days as ICS day abbreviations
   * @param {Object} mt - Meeting time object
   * @return {Array} Array of day abbreviations
   */
  _getMeetingDays(mt) {
    const days = [];
    if (mt.monday) days.push('MO');
    if (mt.tuesday) days.push('TU');
    if (mt.wednesday) days.push('WE');
    if (mt.thursday) days.push('TH');
    if (mt.friday) days.push('FR');
    if (mt.saturday) days.push('SA');
    return days;
  },

  /**
   * Generates unique ID for event
   * @param {Object} course - Course object
   * @param {Object} meeting - Meeting object
   * @return {String} Unique identifier
   */
  _generateUid(course, meeting) {
    const nrc = course.section?.courseReferenceNumber || 'unknown';
    const seq = course.section?.sequenceNumber || '0';
    const room = meeting?.meetingTime?.room || 'none';
    return `${nrc}-${seq}-${room}-${Date.now()}@horarios.ucab`;
  },

  /**
   * Decodes HTML entities
   * @param {String} text - Text with HTML entities
   * @return {String} Decoded text
   */
  _decodeHtmlEntities(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.textContent || div.innerText || '';
  },

  /**
   * Escapes special characters for RFC 5545 compliance
   * @param {String} text - Text to escape
   * @return {String} Escaped text
   */
  _escapeText(text) {
    if (!text) return '';
    return text.replace(/[\\;,\n]/g, (match) => '\\' + match);
  },

  /**
   * Downloads ICS file
   * @param {String} content - ICS file content
   * @param {String} filename - Output filename
   */
  _downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
};
