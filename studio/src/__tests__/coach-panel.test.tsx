import { render, screen } from '@testing-library/react';
import { CoachPanel, type CoachInsight } from '@/components/coach-panel';

const SAMPLE_INSIGHTS: CoachInsight[] = [
  { title: 'When to use', detail: 'Use for baseline reasoning tasks.' },
  { title: 'Failure modes', detail: 'Skipping verification steps.' },
];

describe('CoachPanel', () => {
  it('renders insights when provided', () => {
    render(<CoachPanel insights={SAMPLE_INSIGHTS} />);
    expect(screen.getByText('Coach')).toBeInTheDocument();
    expect(screen.getByText('When to use')).toBeInTheDocument();
    expect(screen.getByText('Failure modes')).toBeInTheDocument();
  });

  it('renders nothing when insights array is empty', () => {
    const { container } = render(<CoachPanel insights={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
