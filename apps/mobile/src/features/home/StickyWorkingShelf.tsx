import { AnimatedLegendList } from "@legendapp/list/reanimated";
import { useState, type ReactElement } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { GestureDetector, useNativeGesture } from "react-native-gesture-handler";
import { threadListV2ListItemsAreEqual, type ThreadListV2ListItem } from "../threads/threadListV2";
import { SwipeableScrollGateProvider, useSwipeableScrollGate } from "./thread-swipe-actions";

export function StickyWorkingShelf(props: {
  readonly items: ReadonlyArray<ThreadListV2ListItem>;
  readonly bottom: number;
  readonly maxHeight: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly extraData: object;
  readonly estimatedItemSize: number;
  readonly renderItem: (
    item: ThreadListV2ListItem,
    gesture: ReturnType<typeof useNativeGesture>,
  ) => ReactElement;
  readonly onScrollBeginDrag: () => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
}) {
  const gesture = useNativeGesture();
  const { swipeEnabled, scrollGateHandlers } = useSwipeableScrollGate({
    onScrollBeginDrag: props.onScrollBeginDrag,
  });
  const [size, setSize] = useState({ count: 0, height: 0 });
  const [header, ...rows] = props.items;
  const contentHeight =
    size.count === rows.length ? size.height : rows.length * props.estimatedItemSize;
  return (
    <View
      testID="sticky-working-shelf"
      onLayout={props.onLayout}
      className="absolute left-0 right-0 z-20 border-t border-border bg-screen"
      style={{
        bottom: props.bottom,
        maxHeight: props.maxHeight,
        paddingLeft: props.paddingLeft,
        paddingRight: props.paddingRight,
      }}
    >
      {header ? props.renderItem(header, gesture) : null}
      {rows.length > 0 ? (
        <SwipeableScrollGateProvider enabled={swipeEnabled}>
          <GestureDetector gesture={gesture}>
            {/* oxlint-disable-next-line t3code/require-registered-list-scroll -- Android-only dock scrolls independently from the primary Home list. */}
            <AnimatedLegendList
              data={rows}
              renderItem={({ item }) => props.renderItem(item, gesture)}
              keyExtractor={(item) => item.key}
              getItemType={(item) => item.type}
              itemsAreEqual={threadListV2ListItemsAreEqual}
              extraData={props.extraData}
              estimatedItemSize={props.estimatedItemSize}
              drawDistance={Math.min(props.maxHeight, 320)}
              recycleItems
              onContentSizeChange={(_, height) => {
                if (height <= 0) return;
                setSize((current) =>
                  current.count === rows.length && current.height === height
                    ? current
                    : { count: rows.length, height },
                );
              }}
              style={{ height: contentHeight, flexShrink: 1, minHeight: 0 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              {...scrollGateHandlers}
            />
          </GestureDetector>
        </SwipeableScrollGateProvider>
      ) : null}
    </View>
  );
}
