import { Icon } from "@iconify/react";
import {
	Button,
	Divider,
	Drawer,
	Group,
	Modal,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type JSX, useEffect } from "react";
import { useSession } from "#react/src/core/hooks/useSession.ts";
import { client } from "#ui/client.ts";
import { useLayoutStore } from "#ui/core/stores/useLayoutStore.tsx";
import { useAccounts } from "#ui/features/settings/hooks/useAccounts.ts";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";
import { GLASS_STYLE } from "#ui/utils/style.ts";

export default function SidebarAccount({
	children,
}: {
	children: (open: () => void) => JSX.Element;
}) {
	const { session, requestClone } = useSession();
	const { accounts, linkAccount, unlinkAccount, deleteUser } = useAccounts();

	const setGestureBlock = useLayoutStore((s) => s.setGestureBlock);
	const setDrawerCloser = useLayoutStore((s) => s.setDrawerCloser);

	const [opened, { open, close }] = useDisclosure(false);
	const [isDeleteOpen, { open: openDelete, close: closeDelete }] =
		useDisclosure(false);

	useEffect(() => {
		setGestureBlock(isDeleteOpen);
	}, [isDeleteOpen, setGestureBlock]);

	useEffect(() => {
		if (opened) {
			setDrawerCloser(close);
			return () => setDrawerCloser(null);
		}
	}, [opened, close, setDrawerCloser]);

	const provider = (id: string, name: string, icon: JSX.Element) => (
		<Group justify="space-between">
			<Group gap={5}>
				{icon}
				<Text>{name}</Text>
			</Group>
			{accounts.data?.find((account) => account.providerId === id) ? (
				accounts.data?.length === 1 ? (
					<Tooltip label="Must have one account" color="gray">
						<Button
							variant="light"
							onClick={() => unlinkAccount.mutate(id)}
							disabled
						>
							Unlink
						</Button>
					</Tooltip>
				) : (
					<Button variant="light" onClick={() => unlinkAccount.mutate(id)}>
						Unlink
					</Button>
				)
			) : (
				<Button variant="default" onClick={() => linkAccount.mutate(id)}>
					Link
				</Button>
			)}
		</Group>
	);

	return (
		<>
			{children(open)}
			<Drawer
				opened={opened}
				onClose={close}
				title={
					session.data?.user && !session.data.user.isAnonymous
						? "Account"
						: "Sign In"
				}
			>
				<Stack>
					{TauriUtils.isTauri() ? (
						<>
							{requestClone.isPending ? (
								<Text size="sm">Waiting for you to sign in...</Text>
							) : (
								<Text c="dimmed" size="sm">
									Use the web to sign in and manage your account.
								</Text>
							)}
							<Button
								variant="default"
								fullWidth
								onClick={() => {
									if (session.data?.user?.isAnonymous) {
										if (requestClone.isPending) {
											requestClone.reset();
										} else {
											requestClone.mutate(async (id) => {
												return await TauriUtils.open(
													`${client.webUrl}/#?clone=${id}`,
												);
											});
										}
									} else {
										void TauriUtils.open(`${client.webUrl}`);
									}
								}}
							>
								{requestClone.isPending ? "Cancel" : "Open Browser"}
							</Button>
							<Text size="xs" c="dimmed" m="0 auto">
								<Button
									size="compact-xs"
									variant="transparent"
									component="a"
									onClick={(e) => {
										e.preventDefault();
										if (session.data?.user?.isAnonymous) {
											if (!requestClone.isPending) {
												requestClone.mutate(async (id) => {
													await navigator.clipboard.writeText(
														`${client.webUrl}/#?clone=${id}`,
													);
												});
											}
										} else {
											void TauriUtils.open(client.webUrl);
										}
									}}
								>
									or copy the link
								</Button>
							</Text>
						</>
					) : (
						<>
							<Text c="dimmed" size="sm">
								Link an account to save chats and settings.
							</Text>
							{provider("google", "Google", <Icon icon="lucide:chromium" />)}
							{provider("github", "GitHub", <Icon icon="lucide:github" />)}
							{provider(
								"huggingface",
								"Hugging Face",
								<Icon icon="lucide:smile" />,
							)}
						</>
					)}
					{session.data?.user && !session.data.user.isAnonymous && (
						<>
							<Divider />
							<Button
								variant="default"
								fullWidth
								mt={10}
								onClick={() => {
									void (async () => {
										await client.auth.signOut();
										window.location.reload();
									})();
								}}
							>
								Sign Out
							</Button>
							<Button
								variant="outline"
								color="red"
								fullWidth
								mt={10}
								onClick={openDelete}
							>
								Delete Account
							</Button>
							<Modal
								opened={isDeleteOpen}
								onClose={closeDelete}
								title="Delete Account"
								styles={{ content: GLASS_STYLE }}
								centered
							>
								<Button
									color="red"
									fullWidth
									onClick={() => {
										deleteUser.mutate();
									}}
									loading={deleteUser.isPending}
									disabled={deleteUser.isPending}
								>
									Confirm
								</Button>
							</Modal>
						</>
					)}
				</Stack>
			</Drawer>
		</>
	);
}
