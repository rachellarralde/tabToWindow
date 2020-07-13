import { WindowType } from "./api.js";
import { createNewWindow } from "./createNewWindow.js";
import { doBackgroundAction } from "./doBackgroundAction.js";
import { getNewWindowBounds } from "./getNewWindowBounds.js";
import { getSizeAndPos } from "./getSizeAndPos.js";
import { getWindowBounds } from "./getWindowBounds.js";
import { moveTabs } from "./moveTabs.js";
import { getOptions } from "./options-storage.js";

export const tabToWindow = async (
  windowType: WindowType | undefined,
  moveToNextDisplay = false,
) => {
  doBackgroundAction(async () => {
    const displaysPromise = new Promise<chrome.system.display.DisplayInfo[]>((resolve) => {
      chrome.system.display.getInfo((displays) => resolve(displays));
    });

    const currentWindowPromise = new Promise<chrome.windows.Window>((resolve, reject) => {
      chrome.windows.getCurrent({}, (win) => {
        if (chrome.runtime.lastError === undefined) {
          resolve(win);
        } else {
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
    });

    const tabsPromise = new Promise<chrome.tabs.Tab[]>((resolve) => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          resolve(tabs);
        }
      });
    });

    const [displays, currentWindow, tabs] = await Promise.all([
      displaysPromise,
      currentWindowPromise,
      tabsPromise,
    ]);

    moveToNextDisplay = moveToNextDisplay && displays.length > 1;

    const calcOverlapArea = (display: chrome.system.display.DisplayInfo) => {
      const wl = currentWindow.left ?? 0;
      const wt = currentWindow.top ?? 0;
      const wr = wl + (currentWindow.width ?? screen.availWidth);
      const wb = wt + (currentWindow.height ?? screen.availWidth);

      const dl = display.bounds.left;
      const dt = display.bounds.top;
      const dr = display.bounds.left + display.bounds.width;
      const db = display.bounds.top + display.bounds.height;

      return (
        Math.max(0, Math.min(wr, dr) - Math.max(wl, dl)) *
        Math.max(0, Math.min(wb, db) - Math.max(wt, dt))
      );
    };

    const currentDisplay = displays.reduce((accum, current) => {
      const accumOverlap = calcOverlapArea(accum);
      const curOverlap = calcOverlapArea(current);
      return curOverlap > accumOverlap ? current : accum;
    }, displays[0]);

    const options = await getOptions();

    const isFullscreen = options.get("copyFullscreen") && currentWindow.state === "fullscreen";
    const isFocused = options.get("focus") === "new";

    // (maybe) move and resize original window
    let origWindow = currentWindow;
    const destroyingOriginalWindow = tabs.length === 1;
    if (
      options.get("resizeOriginal") &&
      !isFullscreen &&
      !destroyingOriginalWindow &&
      !moveToNextDisplay
    ) {
      const vals = await getSizeAndPos(options, "original", currentDisplay.workArea);
      origWindow = await new Promise<chrome.windows.Window>((resolve) => {
        chrome.windows.update(
          origWindow.id,
          {
            width: vals.width,
            height: vals.height,
            left: vals.left,
            top: vals.top,
            state: "normal",
          },
          (win) => resolve(win),
        );
      });
    }

    // move and resize new window
    const activeTab = tabs.find((tab) => tab.active)!;

    const getNextDisplay = () => {
      const currentIndex = displays.indexOf(currentDisplay);
      const nextIndex = (currentIndex + 1) % displays.length;
      return displays[nextIndex];
    };

    // if it's just one tab, the only use case is to convert it into a popup
    // window, so just leave it where it was
    const windowBounds = moveToNextDisplay
      ? getNextDisplay().bounds
      : tabs.length === 1
      ? getWindowBounds(origWindow)
      : await getNewWindowBounds(options, origWindow, currentDisplay.workArea);

    const newWindowType =
      windowType === undefined ? (currentWindow.type === "popup" ? "popup" : "normal") : windowType;

    const [newWin, movedTab] = await createNewWindow(
      activeTab,
      newWindowType,
      windowBounds,
      isFullscreen,
      isFocused,
    );

    // move other highlighted tabs
    const otherTabs = tabs.filter((tab) => tab !== movedTab && tab.highlighted);
    if (otherTabs.length > 0) {
      if (newWindowType === "normal") {
        // move all tabs at once
        const moveIndex = 1;
        const movedTabs = await moveTabs(otherTabs, newWin.id, moveIndex);

        // highlight tabs in new window
        const tabPromises = movedTabs.map((tab) => {
          return new Promise<chrome.tabs.Tab>((resolve) => {
            chrome.tabs.update(tab.id!, { highlighted: true }, () => resolve(tab));
          });
        });

        await Promise.all(tabPromises);
      } else if (newWindowType === "popup") {
        // can't move tabs to a popup window, so create individual ones
        const tabPromises = otherTabs.map((tab) => {
          return createNewWindow(
            tab,
            newWindowType,
            getWindowBounds(newWin),
            isFullscreen,
            isFocused,
          );
        });
        await Promise.all(tabPromises);
      }
    }

    // focus on original window if specified, and it still exists
    // (popping a single tab will destroy the original window)
    if (options.get("focus") === "original" && !destroyingOriginalWindow) {
      chrome.windows.get(currentWindow.id, {}, () => {
        if (chrome.runtime.lastError === undefined) {
          chrome.windows.update(currentWindow.id, { focused: true });
        } else {
          throw new Error(chrome.runtime.lastError.message);
        }
      });
    }
  });
};