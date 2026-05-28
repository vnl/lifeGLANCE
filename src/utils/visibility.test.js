import { describe, it, expect } from 'vitest'
import { precomputeEndpoints, getMilestoneVisibility } from './visibility'

const ongoingChapter = {
  id: 'ch1', title: 'Career', start: '2020-01-01T00:00:00.000Z', end: null,
  milestoneIds: ['m1', 'm2'], defaultMemberVisibility: 'shown',
}

describe('precomputeEndpoints with null end', () => {
  it('does not throw when chapter.end is null', () => {
    expect(() => precomputeEndpoints([ongoingChapter])).not.toThrow()
  })

  it('indexes member milestones for the ongoing chapter', () => {
    const { endpointChapterNames } = precomputeEndpoints([ongoingChapter])
    expect(endpointChapterNames.has('m1')).toBe(true)
    expect(endpointChapterNames.has('m2')).toBe(true)
  })

  it('stores null endDay for ongoing chapter', () => {
    const { endpointChapterNames } = precomputeEndpoints([ongoingChapter])
    const entry = endpointChapterNames.get('m1')[0]
    expect(entry.endDay).toBeNull()
    expect(entry.startDay).toBe('2020-01-01')
  })
})

describe('getMilestoneVisibility with null end', () => {
  it('marks start-date milestone as endpoint for ongoing chapter', () => {
    const precomputed = precomputeEndpoints([ongoingChapter])
    const m = { id: 'm1', date: '2020-01-01T00:00:00.000Z', mainTimelineVisibility: 'inherit' }
    const result = getMilestoneVisibility(m, [ongoingChapter], precomputed, 'main')
    expect(result.reason).toBe('endpoint')
    expect(result.visible).toBe(true)
  })

  it('does not mark mid-chapter milestone as endpoint (null endDay never matches)', () => {
    const precomputed = precomputeEndpoints([ongoingChapter])
    const m = { id: 'm2', date: '2022-06-15T00:00:00.000Z', mainTimelineVisibility: 'inherit' }
    const result = getMilestoneVisibility(m, [ongoingChapter], precomputed, 'main')
    expect(result.reason).toBe('cascade-shown')
    expect(result.visible).toBe(true)
  })
})
