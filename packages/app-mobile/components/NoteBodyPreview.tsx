import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Note from '@joplin/lib/models/Note';
import { NoteEntity } from '@joplin/lib/services/database/types';
import { MarkupLanguage, MarkupToHtml } from '@joplin/renderer';
import Logger from '@joplin/utils/Logger';
import { themeStyle } from './global-style';

const markupToHtml = new MarkupToHtml();
const logger = Logger.create('NoteBodyPreview');

interface Props {
	note: NoteEntity;
	themeId: number;
}

// Load bounded excerpts for mounted cards, rather than adding entire note bodies
// to the Redux notes list. Never read or display locked/encrypted content.
const NoteBodyPreview: React.FC<Props> = ({ note, themeId }) => {
	const [preview, setPreview] = useState({ key: '', text: '' });
	const hidden = !!note.is_locked || !!note.encryption_applied;
	const key = JSON.stringify([note.id, note.updated_time, note.body, hidden, note.markup_language]);

	useEffect(() => {
		if (hidden) return () => {};
		let cancelled = false;
		const load = async () => {
			try {
				const result = await Note.modelSelectOne('SELECT substr(body, 1, 2048) AS body FROM notes WHERE id = ? AND is_locked = 0 AND encryption_applied = 0', [note.id]);
				const text = markupToHtml.stripMarkup(note.markup_language ?? MarkupLanguage.Markdown, result?.body ?? '').slice(0, 600);
				if (!cancelled) setPreview({ key, text });
			} catch (error) {
				logger.warn('Could not load note preview', error);
			}
		};
		void load();
		return () => { cancelled = true; };
	}, [key, hidden, note.id, note.markup_language]);

	const theme = themeStyle(themeId);
	const styles = useMemo(() => StyleSheet.create({
		preview: {
			color: theme.colorFaded,
			fontSize: theme.fontSize,
			marginTop: 8,
		},
	}), [theme]);

	if (hidden || preview.key !== key || !preview.text) return null;
	return <Text style={styles.preview} numberOfLines={6} ellipsizeMode='tail'>{preview.text}</Text>;
};

export default NoteBodyPreview;
