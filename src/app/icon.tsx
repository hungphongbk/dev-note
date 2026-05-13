import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #f8e3c3 0%, #b85c00 100%)",
          color: "#200e00",
          fontSize: 170,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        DN
      </div>
    ),
    {
      ...size,
    }
  );
}
