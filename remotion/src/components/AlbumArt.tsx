import { Img, staticFile } from "remotion";

type AlbumArtProps = {
  size?: number;
};

export const AlbumArt: React.FC<AlbumArtProps> = ({ size = 384 }) => {
  return (
    <Img
      src={staticFile("album-art.png")}
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        objectFit: "cover",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
      }}
    />
  );
};
