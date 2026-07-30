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
import { type JSX, useEffect, useState } from "react";
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
	const [isCloning, setCloning] = useState(false);
	const [cloneInterval, setCloneInterval] = useState<NodeJS.Timeout>();

	const { accounts, linkAccount, unlinkAccount, deleteUser } = useAccounts();

	const setGestureBlock = useLayoutStore((s) => s.setGestureBlock);
	const setDrawerCloser = useLayoutStore((s) => s.setDrawerCloser);
	const { data: session } = client.auth.useSession();

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

	const clone = async (open: boolean) => {
		if (!isCloning) {
			setCloning(true);
			const id = await client.api.user.createClone.mutate(); // TODO - use query
			if (open) void TauriUtils.open(`${client.webUrl}/#?clone=${id}`);
			else void navigator.clipboard.writeText(`${client.webUrl}/#?clone=${id}`);
			setCloneInterval(
				setInterval(() => {
					void (async () => {
						const result = await client.api.user.completeClone.mutate({ id });
						if (!result) return;
						clearInterval(cloneInterval);
						window.location.reload();
					})();
				}, 1000),
			);
		} else {
			setCloning(false);
			clearInterval(cloneInterval);
		}
	};

	return (
		<>
			{children(open)}
			<Drawer
				opened={opened}
				onClose={close}
				title={
					session?.user && !session.user.isAnonymous ? "Account" : "Sign In"
				}
			>
				<Stack>
					{TauriUtils.isTauri() ? (
						<>
							{isCloning ? (
								<Text size="sm">Waiting for you to sign in...</Text>
							) : (
								<Text c="dimmed" size="sm">
									Use the web to manage your account.
								</Text>
							)}
							<Button
								variant="default"
								fullWidth
								onClick={() => {
									if (session?.user?.isAnonymous) {
										if (isCloning) {
											clearInterval(cloneInterval);
											setCloning(false);
										}
										void clone(true);
									} else {
										void TauriUtils.open(`${client.webUrl}`);
									}
								}}
							>
								{isCloning ? "Cancel" : "Open Browser"}
							</Button>
							<Text size="xs" c="dimmed" m="0 auto">
								<Button
									size="compact-xs"
									variant="transparent"
									component="a"
									onClick={(e) => {
										e.preventDefault();

										if (session?.user?.isAnonymous) {
											if (isCloning) {
												clearInterval(cloneInterval);
												setCloning(false);
											}
											void clone(false);
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
					{session?.user && !session.user.isAnonymous && (
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
