import * as React from 'react';
import { render, screen, waitFor } from '../utils/testing/testingLibrary';
import { setupDatabaseAndSynchronizer, switchClient } from '@joplin/lib/testing/test-utils';
import Note from '@joplin/lib/models/Note';
import NoteBodyPreview from './NoteBodyPreview';
import { MarkupLanguage } from '@joplin/renderer';

describe('NoteBodyPreview', () => {
	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(0);
		await switchClient(0);
	});

	test.each([
		[MarkupLanguage.Markdown, '**Readable** [preview](https://example.com)'],
		[MarkupLanguage.Html, '<p><strong>Readable</strong> preview</p>'],
	])('renders plain text for markup language %s', async (markup_language, body) => {
		const note = await Note.save({ title: 'Example', body, markup_language });
		render(<NoteBodyPreview note={note} themeId={1} />);
		expect(await screen.findByText('Readable preview')).toBeVisible();
	});

	test.each(['is_locked', 'encryption_applied'])('does not load or display %s content', async field => {
		const note = await Note.save({ title: 'Private', body: 'Secret preview' });
		const query = jest.spyOn(Note, 'modelSelectOne');
		try {
			render(<NoteBodyPreview note={{ ...note, [field]: 1 }} themeId={1} />);
			expect(query).not.toHaveBeenCalled();
			expect(screen.queryByText('Secret preview')).toBeNull();
		} finally {
			query.mockRestore();
		}
	});

	test('clears an existing preview as soon as its note becomes locked', async () => {
		const note = await Note.save({ title: 'Private', body: 'Secret preview' });
		const view = render(<NoteBodyPreview note={note} themeId={1} />);
		await screen.findByText('Secret preview');
		view.rerender(<NoteBodyPreview note={{ ...note, is_locked: 1 }} themeId={1} />);
		expect(screen.queryByText('Secret preview')).toBeNull();
	});

	test('does not show a previous note excerpt when reusing a card', async () => {
		const first = await Note.save({ title: 'First', body: 'First body' });
		const second = await Note.save({ title: 'Second', body: 'Second body' });
		const view = render(<NoteBodyPreview note={first} themeId={1} />);
		await screen.findByText('First body');
		view.rerender(<NoteBodyPreview note={second} themeId={1} />);
		expect(screen.queryByText('First body')).toBeNull();
		expect(await screen.findByText('Second body')).toBeVisible();
	});

	test('refreshes after editing the note and bounds the displayed excerpt', async () => {
		const note = await Note.save({ title: 'Example', body: 'Original body' });
		const view = render(<NoteBodyPreview note={note} themeId={1} />);
		await screen.findByText('Original body');
		const updated = await Note.save({ id: note.id, body: 'New content '.repeat(300) });
		view.rerender(<NoteBodyPreview note={updated} themeId={1} />);
		await waitFor(() => expect(screen.getByText(/^New content/).props.children).toHaveLength(600));
	});
});
