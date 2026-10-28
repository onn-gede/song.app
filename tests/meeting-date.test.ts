import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bucharestInput,meetingDateISO} from '../lib/meeting-date';
test('v49 saves the selected Romanian hour independently of server/browser timezone',()=>{
 assert.equal(meetingDateISO('2026-11-01T10:15'),'2026-11-01T08:15:00.000Z');
 assert.equal(meetingDateISO('2026-07-01T18:45'),'2026-07-01T15:45:00.000Z');
 assert.equal(meetingDateISO('2026-11-01T08:15:00.000Z'),'2026-11-01T08:15:00.000Z');
 assert.equal(bucharestInput(new Date('2026-11-01T08:15:00Z')),'2026-11-01T10:15');
 for(const value of ['', '2026-02-30T10:15','2026-03-29T03:15','2026-11-01T25:15'])assert.throws(()=>meetingDateISO(value));
});
