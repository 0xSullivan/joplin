import * as React from 'react';
import { Dimensions, FlatList, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '../utils/testing/testingLibrary';
import { setupDatabaseAndSynchronizer, switchClient } from '@joplin/lib/testing/test-utils';
import createMockReduxStore from '../utils/testing/createMockReduxStore';
import setupGlobalStore from '../utils/testing/setupGlobalStore';
import TestProviderStack from './testing/TestProviderStack';
import NoteList from './NoteList';
import Folder from '@joplin/lib/models/Folder';
import Note from '@joplin/lib/models/Note';
import Setting from '@joplin/lib/models/Setting';

// Row interactions are exercised separately. Keep these tests focused on the
// list's layout, navigation, and persisted view preference.
jest.mock('./NoteBodyPreview', () => (): React.ReactNode => null);

describe('NoteList', () => {
	let originalPlatform: typeof Platform.OS;
	beforeEach(async () => {
		originalPlatform = Platform.OS;
		Platform.OS = 'android';
		Dimensions.set({ window: { width: 400, height: 800, scale: 1, fontScale: 1 } });
		await setupDatabaseAndSynchronizer(0);
		await switchClient(0);
	});
	afterEach(() => {
		Platform.OS = originalPlatform;
	});

	const setup = async () => {
		const store = createMockReduxStore();
		setupGlobalStore(store);
		const folder = await Folder.save({ title: 'Notebook' });
		const note = await Note.save({ title: 'Card title', body: 'Note body', parent_id: folder.id });
		store.dispatch({ type: 'FOLDER_UPDATE_ALL', items: [folder] });
		store.dispatch({ type: 'NOTE_UPDATE_ALL', notes: [note], notesSource: folder.id });
		const view = render(<TestProviderStack store={store}><NoteList /></TestProviderStack>);
		return { store, view, note };
	};

	test('switches between grid and list and remembers the preference', async () => {
		const { view, store } = await setup();
		const getList = () => view.UNSAFE_getByType(FlatList);
		fireEvent(screen.getByTestId('note-list'), 'layout', { nativeEvent: { layout: { width: 400 } } });
		expect(getList().props.numColumns).toBe(2);
		fireEvent.press(screen.getByRole('button', { name: 'Switch to list view' }));
		expect(Setting.value('notes.mobileLayout')).toBe('list');
		expect(getList().props.numColumns).toBe(1);
		view.unmount();
		render(<TestProviderStack store={store}><NoteList /></TestProviderStack>);
		expect(screen.getByRole('button', { name: 'Switch to grid view' })).toBeVisible();
	});

	test('keeps cards in one column when the available width is narrow', async () => {
		const { view } = await setup();
		fireEvent(screen.getByTestId('note-list'), 'layout', { nativeEvent: { layout: { width: 320 } } });
		expect(view.UNSAFE_getByType(FlatList).props.numColumns).toBe(1);
	});

	test('opens notes and supports long-press selection in card mode', async () => {
		const { store, note } = await setup();
		fireEvent.press(screen.getByText('Card title'));
		expect(store.getState().route.noteId).toBe(note.id);
		await act(async () => {
			fireEvent(screen.getByText('Card title'), 'longPress');
		});
		expect(store.getState().selectedNoteIds).toContain(note.id);
	});

	test('uses one column with large accessibility fonts', async () => {
		Dimensions.set({ window: { width: 400, height: 800, scale: 1, fontScale: 2 } });
		const { view } = await setup();
		expect(view.UNSAFE_getByType(FlatList).props.numColumns).toBe(1);
	});

	test('retains the existing single-column list on iOS', async () => {
		Platform.OS = 'ios';
		const { view } = await setup();
		expect(view.UNSAFE_getByType(FlatList).props.numColumns).toBe(1);
		expect(screen.queryByRole('button', { name: 'Switch to list view' })).toBeNull();
	});
});
