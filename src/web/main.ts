import './style.css';
import { selectedLocation } from './location-picker.ts';
import { enableDraftDownload } from './report-draft.ts';

enableDraftDownload(selectedLocation);
