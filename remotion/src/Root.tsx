import { Composition, registerRoot } from "remotion";
import { HeroVideo } from "./HeroVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="HeroVideo"
      component={HeroVideo}
      durationInFrames={600}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(RemotionRoot);
