import React, { forwardRef } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

/** Scrolling page with the app's paper background and optional pull-to-refresh. */
const Screen = forwardRef(function Screen(
  { children, onRefresh, refreshing = false, edges = ['top'], contentStyle },
  scrollRef,
) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.skyDeep}
              colors={[colors.skyDeep]}
            />
          ) : undefined
        }
        contentContainerStyle={[{ padding: 16, paddingBottom: 36, gap: 14 }, contentStyle]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
});

export default Screen;
