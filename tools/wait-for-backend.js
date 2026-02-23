import waitOn from "wait-on";

console.log(`Waiting for backend...`);

waitOn({resources: [`http://localhost:${process.env.VITE_DATA_PORT}`]})
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });