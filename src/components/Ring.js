import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';
import { T } from './Primitives';

/** Circular progress ring for the headline attendance figure. */
export default function Ring({ value = 0, size = 104, stroke = 11 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = c - (pct / 100) * c;
  const mid = size / 2;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${pct}% attendance`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <Circle cx={mid} cy={mid} r={r} stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={mid}
          cy={mid}
          r={r}
          stroke={colors.sky}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${mid}, ${mid}`}
        />
      </Svg>
      <T variant="h2" color="#fff" style={{ fontSize: size * 0.24, lineHeight: size * 0.32 }}>
        {pct}%
      </T>
    </View>
  );
}
