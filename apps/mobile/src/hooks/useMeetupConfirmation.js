import { useMutation, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

/**
 * useMeetupConfirmation
 *
 * Handles POST /api/checkins/[id]/confirm-meetup for one attendee at a time.
 * Optimistically marks the confirmation and invalidates the meetups list.
 */
export function useMeetupConfirmation({ checkinId } = {}) {
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: async ({ confirmedUserId, wouldMeetAgain = false }) => {
      const response = await authedFetch(
        `/api/checkins/${checkinId}/confirm-meetup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmedUserId, wouldMeetAgain }),
        },
      );
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(msg);
        err.status = response.status;
        throw err;
      }
      return data;
    },
    onSuccess: async (_data, variables) => {
      // Invalidate the meetups list for the current user so the profile updates.
      await queryClient.invalidateQueries({ queryKey: ["meetups"] });
    },
  });

  return { confirmMutation };
}
