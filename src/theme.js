import { Platform } from 'react-native';

/** Palette carried over from the web app's stylesheet: navy, sky and amber on warm paper. */
export const colors = {
  paper: '#FAF8F5',
  card: '#FFFFFF',

  ink: '#0B2E52',
  inkSoft: '#4A6484',
  muted: '#7488A3',
  line: '#E9EEF4',
  lineStrong: '#D3DEEA',

  navy: '#0A3D74',
  navyDeep: '#072A53',
  sky: '#7FE3FF',
  skyDeep: '#1D8FC4',
  skySoft: '#EAFBFF',
  skySoftStrong: '#D8F6FF',
  amber: '#FBC13B',
  amberDeep: '#E8A520',
  amberSoft: '#FFF3D6',
  cream: '#FBFAF1',
  creamLine: '#F1EEDA',
  link: '#1D6FB8',

  present: '#2FA36B',
  presentDark: '#268A5A',
  presentSoft: '#E1F6EA',
  absent: '#E15241',
  absentSoft: '#FCE4E1',
  pending: '#F0A83B',
  pendingSoft: '#FDF0DA',
  cancelled: '#8CA0B8',
  cancelledSoft: '#EEF1F4',
  holiday: '#7B6EF6',
  holidaySoft: '#EEEBFE',

  backdrop: 'rgba(7, 27, 51, 0.5)',
};

/** Baloo 2 for headings, Inter for everything else. Both are bundled, so they work offline. */
export const fonts = {
  display: 'Baloo2_700Bold',
  displaySemi: 'Baloo2_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
};

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 };

export const shadow = Platform.select({
  ios: {
    shadowColor: '#092B52',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 2 },
  default: { boxShadow: '0 6px 16px -10px rgba(9, 43, 82, 0.35)' },
});

export const STATUS_LABELS = {
  PENDING: 'Not marked',
  PRESENT: 'Present',
  ABSENT: 'Absent',
  CANCELLED: 'Cancelled',
  NO_CLASS: 'No class',
};

/** Colours for each attendance status, used by pills, row borders and calendar dots. */
export const STATUS_COLORS = {
  PENDING: { fg: colors.pending, bg: colors.pendingSoft },
  PRESENT: { fg: colors.present, bg: colors.presentSoft },
  ABSENT: { fg: colors.absent, bg: colors.absentSoft },
  CANCELLED: { fg: colors.cancelled, bg: colors.cancelledSoft },
  NO_CLASS: { fg: colors.holiday, bg: colors.holidaySoft },
};

export const CALENDAR_TYPE_LABELS = {
  HOLIDAY: 'Holiday',
  WORKING_DAY: 'Working day',
  EXAM: 'Exam',
  VACATION: 'Vacation',
  SEMESTER_START: 'Semester start',
  SEMESTER_END: 'Semester end',
  OTHER: 'Other',
};

export const isBlockingType = (type) => type === 'HOLIDAY' || type === 'VACATION';
