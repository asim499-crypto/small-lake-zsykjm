import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";

function App() {
  const [routes, setRoutes] = useState([]);
  const [current, setCurrent] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [view, setView] = useState("draw");
  const [showSaved, setShowSaved] = useState(true);

  useEffect(() => {
    if (routes.length > 0) {
      const newClusters = computeClusters(routes);
      setClusters(newClusters);
    }
  }, [routes]);

  function handleClick(e) {
    setCurrent([...current, [e.latlng.lat, e.latlng.lng]]);
  }

  function saveRoute() {
    if (current.length > 1) {
      setRoutes([...routes, current]);
      setCurrent([]);
    }
  }

  function undo() {
    setCurrent(current.slice(0, -1));
  }

  function cancel() {
    setCurrent([]);
  }

  function interpolateLine(line, numPoints = 100) {
    const lineString = turf.lineString(line);
    const length = turf.length(lineString, { units: "kilometers" });
    const step = length / (numPoints - 1);
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const point = turf.along(lineString, step * i, { units: "kilometers" });
      points.push(point.geometry.coordinates);
    }
    return points;
  }

  function routesAreSimilar(line1, line2, threshold) {
    try {
      const interpolated1 = interpolateLine(line1);
      const interpolated2 = interpolateLine(line2);
      let matchCount = 0;

      interpolated1.forEach((pt) => {
        const ptTurf = turf.point(pt);
        const isClose = interpolated2.some((p) => {
          return (
            turf.distance(ptTurf, turf.point(p), { units: "kilometers" }) <= 0.2
          );
        });
        if (isClose) matchCount++;
      });

      return matchCount / interpolated1.length >= threshold;
    } catch (error) {
      console.error("Error in routesAreSimilar:", error);
      return false;
    }
  }

  function computeClusters(allRoutes) {
    const newClusters = [];
    const threshold = 0.5; // proportion overlap threshold

    allRoutes.forEach((route) => {
      let matched = false;

      for (const cluster of newClusters) {
        if (routesAreSimilar(route, cluster[0], threshold)) {
          cluster.push(route);
          matched = true;
          break;
        }
      }

      if (!matched) {
        newClusters.push([route]);
      }
    });

    return newClusters;
  }

  function getMedianLine(cluster) {
    if (!cluster || cluster.length === 0) return [];

    const interpolatedRoutes = cluster.map((route) => interpolateLine(route));
    const numPoints = interpolatedRoutes[0].length;
    const median = [];

    for (let i = 0; i < numPoints; i++) {
      let sumLat = 0,
        sumLng = 0;
      for (let j = 0; j < interpolatedRoutes.length; j++) {
        sumLat += interpolatedRoutes[j][i][1];
        sumLng += interpolatedRoutes[j][i][0];
      }
      median.push([
        sumLat / interpolatedRoutes.length,
        sumLng / interpolatedRoutes.length,
      ]);
    }
    return median;
  }

  return (
    <>
      <button onClick={() => setView("draw")}>Draw Mode</button>
      <button onClick={saveRoute}>Save Route</button>
      <button onClick={undo}>Undo</button>
      <button onClick={cancel}>Cancel</button>
      <button onClick={() => setView("median")}>Show Median Map</button>
      <button onClick={() => setShowSaved(!showSaved)}>
        {showSaved ? "Hide Saved Routes" : "Show Saved Routes"}
      </button>

      <MapContainer
        center={[43.65, -79.38]}
        zoom={13}
        style={{ height: "90vh" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {view === "draw" && current.length > 0 && (
          <Polyline positions={current} color="orange" />
        )}

        {showSaved &&
          routes.map((r, i) => (
            <Polyline key={`saved-${i}`} positions={r} color="blue">
              <Tooltip permanent>Saved Route {i + 1}</Tooltip>
            </Polyline>
          ))}

        {view === "median" &&
          clusters.map((c, i) => {
            const medianLine = getMedianLine(c);
            return medianLine.length > 0 ? (
              <Polyline key={i} positions={medianLine} color="black">
                <Tooltip permanent>Median Route {i + 1}</Tooltip>
              </Polyline>
            ) : null;
          })}

        <MapClickHandler onClick={handleClick} />
      </MapContainer>
    </>
  );
}

function MapClickHandler({ onClick }) {
  useMapEvents({
    click: onClick,
  });
  return null;
}

export default App;
