import workspaceModel from "../models/workspace.model";

const cleanupVisitors = async () => {
  const now = new Date();
  const expiryDate = new Date(now.getTime() - 3600 * 1000);

  try {
    const result = await workspaceModel.updateMany(
      {},
      {
        $pull: {
          members: {
            role: "visitor",
            createdAt: { $lt: expiryDate },
          },
        },
      }
    );
    console.log(
      `Expired visitor members removed successfully from workspaces.`
    );
  } catch (error) {
    console.error("Error removing expired visitor members:", error);
  }
};

// Run the script every hour
setInterval(cleanupVisitors, 3600 * 1000);

// Optional: To start cleaning when the application is launched
cleanupVisitors();

export default cleanupVisitors;
