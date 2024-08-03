import { WindowType } from "./api.js";
import { getOptions } from "./options-storage.js";

const kLookup: Readonly<Record<WindowType, string>> = {
  normal: "Window",
  popup: "Popup",
};

export const updateActionButton = async () => {
  const options = await getOptions();
  const type = options.get("menuButtonType");
  const label = kLookup[type];
  chrome.action.setTitle({ title: `Tab to ${label}` });
};
