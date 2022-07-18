import { nanoid } from 'nanoid/non-secure';
import React from 'react';
import useLatestCallback from 'use-latest-callback';

import NavigationHelpersContext from './NavigationHelpersContext';
import NavigationRouteContext from './NavigationRouteContext';
import PreventRemoveContext, { PreventedRoutes } from './PreventRemoveContext';

type Props = {
  children: React.ReactNode;
};

type PreventedRoutesMap = Map<
  string,
  {
    routeKey: string;
    preventRemove: boolean;
  }
>;

const transformPreventedRoutes = (
  preventedRoutesMap: PreventedRoutesMap
): PreventedRoutes => {
  // create an array from values from map
  const preventedRoutesToTransform = [...preventedRoutesMap.values()];
  // when routeKey was in the map we can safely assume it should be prevented
  const preventedRoutesWithRepetition = preventedRoutesToTransform.map(
    ({ routeKey }) => ({ [routeKey]: { preventRemove: true } })
  );
  // remove duplicates
  const preventedRoutesArr = [...new Set(preventedRoutesWithRepetition)];
  // and create an object from that array
  return Object.assign({}, ...preventedRoutesArr);
};

/**
 * Component used for managing which routes have to be prevented from removal in native-stack.
 */
export default function PreventRemoveProvider({ children }: Props) {
  const [parentId] = React.useState(() => nanoid());
  const [preventedRoutesMap, setPreventedRoutesMap] =
    React.useState<PreventedRoutesMap>(new Map());

  const navigation = React.useContext(NavigationHelpersContext);
  const route = React.useContext(NavigationRouteContext);

  // take `setPreventRemove` from parent context
  const { setPreventRemove: setParentPrevented } =
    React.useContext(PreventRemoveContext);

  const setPreventRemove = useLatestCallback(
    (id: string, routeKey: string, preventRemove: boolean): void => {
      if (
        preventRemove &&
        (navigation == null ||
          navigation
            ?.getState()
            .routes.every((route) => route.key !== routeKey))
      ) {
        throw new Error(
          `Couldn't find a route with the key ${routeKey}. Is your component inside NavigationContent?`
        );
      }

      setPreventedRoutesMap((prevPrevented) => {
        // values haven't changed - do nothing
        if (
          routeKey === prevPrevented.get(id)?.routeKey &&
          preventRemove === prevPrevented.get(id)?.preventRemove
        ) {
          return prevPrevented;
        }

        const nextPrevented = new Map(prevPrevented);

        if (preventRemove) {
          nextPrevented.set(id, {
            routeKey,
            preventRemove,
          });
        } else {
          nextPrevented.delete(id);
        }

        return nextPrevented;
      });
    }
  );

  const isPrevented = [...preventedRoutesMap.values()].some(
    ({ preventRemove }) => preventRemove
  );

  React.useEffect(() => {
    if (route?.key !== undefined && setParentPrevented !== undefined) {
      // when route is defined (and setParentPrevented) it means we're in a nested stack
      // route.key then will host route key of parent
      setParentPrevented(parentId, route.key, isPrevented);
      return () => {
        setParentPrevented(parentId, route.key, false);
      };
    }

    return;
  }, [parentId, isPrevented, route?.key, setParentPrevented]);

  const value = React.useMemo(
    () => ({
      setPreventRemove,
      preventedRoutes: transformPreventedRoutes(preventedRoutesMap),
    }),
    [setPreventRemove, preventedRoutesMap]
  );

  return (
    <PreventRemoveContext.Provider value={value}>
      {children}
    </PreventRemoveContext.Provider>
  );
}