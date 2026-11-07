import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import { FlatList, Text, StyleSheet, Button, View, Platform, useWindowDimensions } from 'react-native';
import { FolderEntity, NoteEntity } from '@joplin/lib/services/database/types';
import { AppState } from '../utils/types';
import getEmptyFolderMessage from '@joplin/lib/components/shared/NoteList/getEmptyFolderMessage';
import Folder from '@joplin/lib/models/Folder';
import Setting from '@joplin/lib/models/Setting';
import { _, _n } from '@joplin/lib/locale';
import NoteItem from './NoteItem';
import IconButton from './IconButton';
import { themeStyle } from './global-style';

interface NoteListProps {
	themeId: number;
	dispatch: Dispatch;
	notesSource: string;
	items: NoteEntity[];
	folders: FolderEntity[];
	selectedFolderId: string|null;
	layout: string;
}

const NoteListComponent: React.FC<NoteListProps> = props => {
	const rootRef = useRef<FlatList<NoteEntity>>(null);
	const { width: windowWidth, fontScale } = useWindowDimensions();
	const [availableWidth, setAvailableWidth] = useState(windowWidth);
	const useCards = Platform.OS === 'android';
	// Keep cards readable on narrow screens and with large accessibility fonts.
	const numColumns = useCards && props.layout === 'grid' && availableWidth >= 360 && fontScale <= 1.3 ? 2 : 1;
	const theme = themeStyle(props.themeId);
	const styles = useMemo(() => StyleSheet.create({
		root: { flex: 1 },
		toolbar: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingLeft: theme.marginLeft,
			paddingRight: 4,
		},
		count: { color: theme.colorFaded, fontSize: theme.fontSize },
		toggle: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
		toggleIcon: { color: theme.color, fontSize: 22 },
		content: { paddingHorizontal: 6, paddingBottom: 100 },
		cell: { width: numColumns === 2 ? '50%' : '100%', padding: 6 },
		noItemMessage: {
			padding: theme.marginTop,
			fontSize: theme.fontSize,
			color: theme.color,
			textAlign: 'center',
		},
	}), [theme, numColumns]);

	useEffect(() => {
		rootRef.current?.scrollToOffset({ offset: 0, animated: false });
	}, [props.notesSource]);

	const createNotebook = () => {
		props.dispatch({ type: 'NAV_GO', routeName: 'Folder', folderId: null });
	};

	const emptyContent = !Folder.atLeastOneRealFolderExists(props.folders) ? (
		<View>
			<Text style={styles.noItemMessage}>{_('You currently have no notebooks.')}</Text>
			<Button title={_('Create a notebook')} onPress={createNotebook} />
		</View>
	) : (
		<Text style={styles.noItemMessage}>{getEmptyFolderMessage(props.folders, props.selectedFolderId)}</Text>
	);

	return <View testID='note-list' style={styles.root} onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}>
		{useCards && <View style={styles.toolbar}>
			<Text style={styles.count}>{_n('%d note', '%d notes', props.items.length, props.items.length)}</Text>
			<IconButton
				themeId={props.themeId}
				description={props.layout === 'grid' ? _('Switch to list view') : _('Switch to grid view')}
				iconName={props.layout === 'grid' ? 'ionicon list-outline' : 'ionicon grid-outline'}
				iconStyle={styles.toggleIcon}
				contentWrapperStyle={styles.toggle}
				onPress={() => Setting.setValue('notes.mobileLayout', props.layout === 'grid' ? 'list' : 'grid')}
			/>
		</View>}
		<FlatList
			// React Native requires a remount when the column count changes.
			key={numColumns}
			ref={rootRef}
			data={props.items}
			numColumns={numColumns}
			contentContainerStyle={useCards ? styles.content : undefined}
			renderItem={({ item, index }) => useCards ? (
				<View style={styles.cell}><NoteItem note={item} index={index} card={true} /></View>
			) : <NoteItem note={item} index={index} />}
			keyExtractor={item => item.id}
			ListEmptyComponent={emptyContent}
		/>
	</View>;
};

export default connect((state: AppState) => ({
	items: state.notes,
	folders: state.folders,
	notesSource: state.notesSource,
	themeId: state.settings.theme,
	selectedFolderId: state.selectedFolderId,
	layout: state.settings['notes.mobileLayout'],
}))(NoteListComponent);
