import { IconCards, IconScan, IconSettings, IconHome } from "@tabler/icons-react";
// Root import on purpose: core-ui shares `erxes-ui` as a Module Federation
// singleton keyed on the bare specifier, so deep imports would bundle a second
// private copy instead of reusing the host's.
import { NavigationMenuLinkItem, Sidebar } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };
import { PureLogoIcon } from "../components/PureLogo";

export const Navigation = () => (
  <Sidebar.Group>
    <Sidebar.GroupContent>
      <Sidebar.Menu>
        <NavigationMenuLinkItem
          name="Pure-Ed"
          icon={IconHome}
          path={`/${manifest.ui.path}`}
        />
        <NavigationMenuLinkItem
          name="Зураг уншуулах"
          icon={IconScan}
          path={`/${manifest.ui.path}/scans`}
        />
        <NavigationMenuLinkItem
          name="Давтлага"
          icon={IconCards}
          path={`/${manifest.ui.path}/study`}
        />
        <NavigationMenuLinkItem
          name="Settings"
          icon={IconSettings}
          path={`/${manifest.ui.path}/settings`}
        />
      </Sidebar.Menu>
    </Sidebar.GroupContent>
  </Sidebar.Group>
);
