import { makeStyles } from "@fluentui/react-components";

import { getText } from "@/localization/en";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
});

export const PageNotFound = () => {
  const styles = useStyles();
  return (
    <div className={styles.container}>
      <h1>{getText("general.pageNotFound")}</h1>
    </div>
  );
};
