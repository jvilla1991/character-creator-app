import {
  dmLongRestWaitHint, longRestFinishedAt, longRestWaitFor, segmentsForward, tickLongRest,
} from './long-rest-limit';

// The same cases as the server's LongRestClockTest: the two must phrase the wait alike.
describe('long rest limit (one every 24 hours on the campaign clock)', () => {
  it('no record means no wait', () => {
    expect(longRestWaitFor(null, 'morning')).toBeNull();
  });

  it('a rest that just finished in the morning can be followed by one tonight', () => {
    const wait = longRestWaitFor(longRestFinishedAt('morning'), 'morning')!;
    expect(wait).toEqual({
      finishedTimeOfDay: 'morning',
      segmentsSince: 0,
      segmentsLeft: 2,
      availableTimeOfDay: 'night',
      availableTomorrow: false,
      reason: 'The party finished a long rest this morning. The next one can start tonight.',
    });
  });

  it('one segment later the wait is shorter but the answer is the same; two later it is over', () => {
    const one = tickLongRest(longRestFinishedAt('morning'));
    expect(longRestWaitFor(one, 'noon')!.segmentsLeft).toBe(1);
    expect(longRestWaitFor(one, 'noon')!.reason)
      .toBe('The party finished a long rest this morning. The next one can start tonight.');
    expect(longRestWaitFor(tickLongRest(one), 'night')).toBeNull();
  });

  it('a rest finished at noon opens the next morning', () => {
    expect(longRestWaitFor(longRestFinishedAt('noon'), 'noon')!.reason)
      .toBe('The party finished a long rest at noon. The next one can start tomorrow morning.');
    const later = longRestWaitFor(tickLongRest(longRestFinishedAt('noon')), 'night')!;
    expect(later.availableTimeOfDay).toBe('morning');
    expect(later.availableTomorrow).toBeTrue();
  });

  it('a rest finished at night opens at noon the next day', () => {
    expect(longRestWaitFor(longRestFinishedAt('night'), 'night')!.reason)
      .toBe('The party finished a long rest tonight. The next one can start tomorrow at noon.');
    expect(longRestWaitFor(tickLongRest(longRestFinishedAt('night')), 'morning')!.reason)
      .toBe('The party finished a long rest last night. The next one can start at noon.');
  });

  it('stops counting once the wait is over, and leaves a missing record alone', () => {
    expect(tickLongRest(longRestFinishedAt('morning'), 7)!.segmentsSince).toBe(2);
    expect(tickLongRest(null)).toBeNull();
    expect(tickLongRest(longRestFinishedAt('morning'), 0)!.segmentsSince).toBe(0);
  });

  it('a clock nobody set means no wait', () => {
    expect(longRestWaitFor(longRestFinishedAt('morning'), null)).toBeNull();
  });

  it('counts how far forward a hand-set time of day is', () => {
    expect(segmentsForward('morning', 'night')).toBe(2);
    expect(segmentsForward('morning', 'noon')).toBe(1);
    expect(segmentsForward('night', 'morning')).toBe(1);
    expect(segmentsForward('noon', 'noon')).toBe(0); // a new date alone is not time passing
  });

  it('tells the DM how to move on', () => {
    const wait = longRestWaitFor(longRestFinishedAt('morning'), 'morning')!;
    expect(dmLongRestWaitHint(wait)).toBe(
      'The party finished a long rest this morning. The next one can start tonight. '
      + 'Advance the clock, or set a later time of day, to move on.');
  });
});
